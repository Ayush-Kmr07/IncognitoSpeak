//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;

const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')


const app = express();

// console.log(process.env.API_KEY);

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDB",{useNewUrlParser:true,useUnifiedTopology:true}).then(()=>{
    console.log("Connected to MongoDB successfully");
}).catch((err)=>{
    console.log(err);
})

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
}); 


// userSchema.plugin(encrypt,{secret: process.env.SECRET, encryptedFields: ["password"]});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
// passport.serializeUser(User.serializeUser());  works for only local strategy(passport-local-mongoose)
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function(req,res){ 
    res.render("home");
});
app.get("/auth/google",
 passport.authenticate('google', { scope: ['profile'] })
 );

 app.get('/auth/google/secrets', 
 passport.authenticate('google', { failureRedirect: '/login' }),
 function(req, res) {
   // Successful authentication, redirect home.
   res.redirect('/secrets');
 });

app.get("/login", function(req,res){
    res.render("login");
});
app.get("/register", function(req,res){
    res.render("register");
});
app.get("/secrets", function(req,res){
    // if(req.isAuthenticated()){
    //     res.render("secrets");
    // } else {
    //     res.redirect("/login");
    // }
User.find({"secret": {$ne : null}})
.then((foundUsers)=>{
    if(foundUsers){
        res.render("secrets", {userWithSecrets: foundUsers});
    }
})
.catch(err => {
    console.log(err);
});


});

app.get("/submit", function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    } else {
        res.redirect("/login");
    }
})

app.get("/logout", function(req,res){
    req.logout(function(err){
        if (err){
            console.log(err);
        } else {
            res.redirect("/");
        }
    });
   
});

app.post("/register", function(req,res){

    // bcrypt.hash(req.body.password, saltRounds,function(err,hash){
    //     const newUser = new User({
    //         email: req.body.username,
    //         // password: md5(req.body.password)
    //         password: hash 
    //     });
    //     newUser.save()
    //     .then(()=>{
    //         res.render("secrets");
    //         // console.log(password);
    //     })
    //     .catch(err => {
    //         console.log(err);
    //     });
    
    // });
    //---------------------------------------------------------------------------------
    // newUser.save(function(err){
    //     if(err){
    //         console.log(err);
    //     }else{
    //         res.render("secrets");
    //     }
    // });

    //---------------------------------Passport----------------------------------------

    User.register({username: req.body.username},req.body.password)  //passport-express-mongoose
    .then(()=>{
        passport.authenticate("local")(req,res,function(){
            res.redirect("/secrets");
        })
    })
    .catch(err =>{
        console.log(err);
        res.redirect("/register");
    })
});


app.post("/login", function(req,res){
    const username = req.body.username;
    const password = req.body.password;

    // User.findOne({email: username}, function(err, foundUser){
    //     if(err){
    //         console.log(err);
    //     } else {
    //         if(foundUser) {
    //             if(foundUser.password === password) {
    //                 res.render("secrets");
    //             }
    //         }
    //     }
    // });
//--------------------------------------------------------------------------
    // User.findOne({email: username})
    // .then((foundUser)=>{
       
    //     if(foundUser){
    //         bcrypt.compare(password,foundUser.password).then(function(result) {
    //             if(result===true)
    //             {
    //                 res.render("secrets");
    //             }
                
    //         });
            
                
    //             // console.log("pp",password);
            
    //     }
    // })
    // .catch(err => {
    //     console.log(err);
    // });

//--------------------------------------------Passport------------------------------------
const user = new User({
    username: req.body.username,
    password: req.body.password
});

req.login(user, function(err){
    if(err){
        console.log(err);
    } else {
        passport.authenticate("local")(req,res,function(){
            res.redirect("/secrets");
        });
    }
});

});

app.post("/submit",function(req,res){
    console.log(req.user);
    const submittedSecret = req.body.secret;
    User.findById(req.user.id) 
    .then((foundUser)=>{
        if(foundUser){
            foundUser.secret=submittedSecret;
            foundUser.save()
            .then(()=>{
                res.redirect("/secrets");
            })
            .catch(err => {
                console.log(err);
            })
        }
    })
    .catch(err =>{
        console.log(err);
    })
        
})

app.listen(3000, function(){
    console.log("Server started on port 3000.")
});
