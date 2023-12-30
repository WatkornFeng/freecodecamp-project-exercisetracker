require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
mongoose
  .connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB connection established"))
  .catch((error) => console.log(error.message));

const exerciseLogSchema = new mongoose.Schema({
  description: String,
  duration: Number,
  date: Date,
});
const userSchema = new mongoose.Schema({
  username: String,
  count: { type: Number, default: 0 },
  log: [exerciseLogSchema],
});
const User = mongoose.model("user", userSchema);

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname + "/public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/views/index.html"));
});
app.post("/api/users", async (req, res) => {
  const username = req.body.username;
  const data = await User.create({ username: username });

  res.json({ username: data.username, _id: data._id });
});
app.get("/api/users", async (req, res) => {
  await User.find()
    .select("-log -count")
    .then((data) => {
      if (data.length === 0) {
        return res.json({
          message: "No users found",
        });
      }
      return res.json(data);
    });
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  const id = req.body[":_id"];
  const description = req.body["description"];
  const duration = req.body["duration"];
  let date = req.body["date"] || new Date();

  const newExercise = {
    description,
    duration,
    date: new Date(date),
  };

  const user = await User.findOneAndUpdate(
    { _id: id }, // Replace with the actual _id of the user
    { $push: { log: newExercise }, $inc: { count: 1 } },
    { new: true } // // Return the updated document
  );

  if (!user) {
    return res.json({
      message: "User not found",
    });
  }

  return res.json({
    _id: user._id,
    username: user.username,
    date: new Date(date).toDateString(),
    duration: duration,
    description: description,
  });
});
app.get("/api/users/:_id/logs", async (req, res) => {
  const fromDate = req.query.from;
  const toDate = req.query.to;
  const logLimit = parseInt(req.query.limit);
  const userId = req.params._id;

  if (fromDate || toDate || logLimit) {
    const userFilter = await User.findOne({
      _id: userId,
    }).select("username log");

    let log;

    if (fromDate && !toDate) {
      log = userFilter.log
        .filter((e) => {
          return e.date >= new Date(fromDate);
        })
        .sort((a, b) => a.date - b.date);
    }
    if (toDate && !fromDate) {
      log = userFilter.log
        .filter((e) => {
          return e.date <= new Date(toDate);
        })
        .sort((a, b) => b.date - a.date);
    }
    if (fromDate && toDate) {
      log = userFilter.log
        .filter((e) => {
          return e.date >= new Date(fromDate) && e.date <= new Date(toDate);
        })
        .sort((a, b) => a.date - b.date);
    }

    let sortData = log;
    if (logLimit && !fromDate && !toDate) {
      sortData = userFilter.log
        .sort((a, b) => b.date - a.date)
        .slice(0, logLimit);
    }

    if (logLimit && (fromDate || toDate)) {
      sortData = log.slice(0, logLimit);
    }

    const finalLog = sortData.map((e) => {
      return {
        description: e.description,
        duration: e.duration,
        date: e.date,
      };
    });
    return res.json({
      _id: userId,
      username: userFilter.username,
      count: finalLog.length,
      log: finalLog,
    });
  }
  // in case no query string is provided
  const user = await User.findOne({
    _id: userId,
  });

  if (!user) {
    return res.json({
      message: "User not found",
    });
  }

  const exercises = user.log.map((e) => {
    return {
      description: e.description,
      duration: e.duration,
      date: e.date,
    };
  });

  return res.json({
    _id: user._id,
    username: user.username,
    count: user.count,
    log: exercises,
  });
});
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
