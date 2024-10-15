const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyparser = require("body-parser");
const bycrpt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./model/usermodel");
const Router = require("./router/router.js");
const Router2 = require("./router/router2");
const { tokenVerify } = require("./Function/index");
const Project = require("./model/project");
const connected = require("./db/db");
require("dotenv").config();

const port=process.env.PORT || 9000

app = express();


app.use(cors({ origin: process.env.FRONT_LINK, methods: ["GET", "POST"] }));
app.use(express.json());
app.use(bodyparser.urlencoded({ extended: true }));



connected();

app.use("/user", Router);

app.use("/project", Router2);

app.post("/login-user", async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body)
  const user = await User.findOne({ email });

  if (!user) {
    return res.json({ error: "user not found", redirect: "" });
  } else {
    if (!user.varified) {
      return res.json({ error: "User is not varified" });
    }
 if (await bcrypt.compare(password, user.password)) {
  const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
    expiresIn: 3600,
  });
  return res.status(201).json({ status: "ok", data: token });  // Fix here
}

    return res.json({ status: "error", error: "INVALID PASSWORD" });
  }
});

app.post("/userData", async (req, res) => {
  try {
    const { token } = req.body;
    const result = await tokenVerify(token);
    // console.log(result)
    if (result.status === "error") {
         return res.json(result);

    } else {
      const userId = result.data._id;
      // console.log(userId);
const updatedProject = await Project.findOneAndUpdate(
  { userId: userId },
  { $pull: { notifications: { expiredAt: { $lt: Date.now() } } } },
  { new: true }
);

if (!updatedProject) {
  return res.json({
    status: "error",
    data: "No user found",
    redirect: "",
  });
}

res.json({
  status: "ok",
  data: {
    userId: updatedProject.userId,
    Fname: result.data.Fname,
    projects: updatedProject.projects,
    notifications: updatedProject.notifications,
    notifCount: updatedProject.notifCount,
  },
});

    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port,()=>{
  console.log(" server is listen on port 9000")
})
