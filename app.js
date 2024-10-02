const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const userModel = require("./models/user");
const postModel = require("./models/post");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer  = require('multer')
const crypto = require("crypto");

const app = express();

app.set("view engine" , "ejs");
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")))

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './public/images/uploads')
    },
    filename: function (req, file, cb) {
        crypto.randomBytes(12,function(err , bytes){
            const fn = bytes.toString("hex") + path.extname(file.originalname)
            cb(null, fn)
        })
    }
})

const upload = multer({ storage: storage })


app.get("/",(req,res)=>{
    res.render("index");
})

app.post("/register",async (req,res)=>{
    const {username,name,email,password,age} = req.body;
    let user = await userModel.findOne({email});
    if(user){res.status(500).redirect("/login");
    } else { 
        bcrypt.genSalt(10,(err,salt)=>{
          bcrypt.hash(password,salt,async (err,hash)=>{
            const createduser = await userModel.create({
                username,
                name,
                email,
                password : hash,
                age
            })
        let token = jwt.sign({email:email,userid:createduser._id},"secret");
        res.cookie("token",token);
        res.redirect("/login")
        })
    })
  }
})

app.get("/login",(req,res)=>{
    res.render("login");
})

app.post("/login",async (req,res)=>{
  const {email,password} = req.body;
  let user = await userModel.findOne({email});
  if(!user) return res.send("something went wrong");
  bcrypt.compare(password,user.password,(err,result)=>{
    if(result){
        let token = jwt.sign({email:email,userid:user._id},"secret");
        res.cookie("token",token);
        res.status(200)
        res.redirect("/profile");
    } else {
        res.send("something went wrong");
    }
  })
})

app.get("/logout",(req,res)=>{
    res.cookie("token","");
    res.render("login");
})

app.get("/profile",isLoggedIn,async (req,res)=>{
    let users = await userModel.findOne({email:req.user.email}).populate("posts");
    res.render("profile",{users});
})

app.post("/post",isLoggedIn, async (req,res)=>{
    let users = await userModel.findOne({email:req.user.email});
    let createdpost = await postModel.create({
        user : users._id,
        content: req.body.content
    })
    users.posts.push(createdpost._id);
    await users.save();
    res.redirect("/profile")
})

app.get("/multerTest",(req,res)=>{
    res.render("test");
})

app.post("/upload",upload.single("multer_file"),async (req,res)=>{
    console.log(req.file)
})

function isLoggedIn(req,res,next){
    if(req.cookies.token ===""){
        res.redirect("/login");
    } else {
        let data = jwt.verify(req.cookies.token,"secret");
        req.user = data;
    }
    next();
}

app.get("/like/:id",isLoggedIn,async (req,res)=>{
    let post = await postModel.findOne({_id:req.params.id}).populate("user");
    if(post.likes.indexOf(req.user.userid)=== -1){
        post.likes.push(req.user.userid)
    } else {
        post.likes.splice(post.likes.indexOf(req.user.userid),1);
    }
    await post.save();
    res.redirect("/profile");
})

app.get("/edit/:id",isLoggedIn,async (req,res)=>{
    let post = await postModel.findOne({_id:req.params.id}).populate("user");
   
    res.render("edit",{post});
})

app.post("/update/:id",isLoggedIn,async (req,res)=>{
    let post = await postModel.findOneAndUpdate({_id:req.params.id},{content:req.body.content},{new:true});
    res.redirect("/profile")
})

app.listen(3000);