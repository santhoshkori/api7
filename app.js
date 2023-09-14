const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const main_path = path.join(__dirname, "twitterClone.db");
//console.log(main_path);
let tweet = null;

const connect_to_tweet_DB = async () => {
  try {
    tweet = await open({
      filename: main_path,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at port 3000");
    });
  } catch (e) {
    console.log(`${e.message}`);
    process.exit(1);
  }
};

connect_to_tweet_DB();

app.post("/register", async (request, response) => {
  let { username, name, password, gender, location } = request.body;
  const length_pass = password.length;
  const hashed_pass = await bcrypt.hash(password, 10);
  //console.log(username);
  const check_user = `SELECT * FROM user WHERE username="${username}";`;
  const get_user = await tweet.get(check_user);
  //console.log(get_user);
  if (get_user !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (length_pass < 6) {
      response.status(400);
      response.send("Password is too short");
    } else if (length_pass >= 6) {
      const register_query = `
      INSERT INTO user (name,username,password,gender)
      VALUES
      ("${name}","${username}","${hashed_pass}","${gender}")
      ;`;
      const register_user = await tweet.run(register_query);
      response.send("User created successfully");
    }
  }
});

//----login
app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  const check_user = `SELECT * FROM user WHERE username="${username}";`;
  const get_user = await tweet.get(check_user);
  //console.log(get_user);
  if (get_user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const compare_pass = await bcrypt.compare(password, get_user.password);
    //console.log(compare_pass);
    if (compare_pass === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "mytoken");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//---middole ware
const auth_middleware_fun = (request, response, next) => {
  let jwt_tk;
  const auth_headers = request.headers["authorization"];
  if (auth_headers !== undefined) {
    jwt_tk = auth_headers.split(" ")[1];
  }
  if (jwt_tk === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwt_tk, "mytoken", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get(
  "/user/tweets/feed/",
  auth_middleware_fun,
  async (request, response) => {
    //console.log("user_op");
    const user_name = request.username;
    //console.log(user_name);
    const latest_tweete_query = `
    SELECT 
    *
    FROM 
    user 
    WHERE
    username="${user_name}"
    ;`;
    const find_user = await tweet.get(latest_tweete_query);
    const login_user_id = find_user.user_id;
    const get_tweets_of_people = `
    SELECT
    user.username,tweet,tweet.date_time AS dateTime
    FROM 
    follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id
    
    INNER JOIN user
ON tweet.user_id = user.user_id
WHERE
follower.follower_user_id=${login_user_id}
ORDER BY tweet.date_time DESC

LIMIT 4
OFFSET 0
    ;`;
    const get_tweets = await tweet.all(get_tweets_of_people);
    response.send(get_tweets);
  }
);

app.get("/user/following/", auth_middleware_fun, async (request, response) => {
  const user_name = request.username;
  //console.log(user_name);
  const latest_tweete_query = `
    SELECT 
    *
    FROM 
    user 
    WHERE
    username="${user_name}"
    ;`;
  const find_user = await tweet.get(latest_tweete_query);
  const login_user_id = find_user.user_id;

  const get_name_person_details = `
  SELECT
  user.name
  FROM
  follower INNER JOIN user on follower.following_user_id=user.user_id
  WHERE
  follower.follower_user_id=${login_user_id}
  ;`;
  const get_names = await tweet.all(get_name_person_details);
  response.send(get_names);
});
//api--5 Returns the list of all names of people who follows the user
app.get("/user/followers/", auth_middleware_fun, async (request, response) => {
  const user_name = request.username;
  //console.log(user_name);
  const latest_tweete_query = `
    SELECT 
    *
    FROM 
    user 
    WHERE
    username="${user_name}"
    ;`;
  const find_user = await tweet.get(latest_tweete_query);
  const login_user_id = find_user.user_id;
  const followers_query = `
  SELECT
  user.name
  FROM
  follower INNER JOIN user ON follower.follower_user_id=user.user_id
  WHERE 
  follower.following_user_id=${login_user_id}
  ;`;
  const get_followers = await tweet.all(followers_query);
  response.send(get_followers);
});
//api 6
app.get("/tweets/:tweetId/", auth_middleware_fun, async (request, response) => {
  const { tweetId } = request.params;

  const user_name = request.username;

  ///////////////////////////////////////////////////
  const latest_tweete_query = `
    SELECT 
    *
    FROM 
    user 
    WHERE
    username="${user_name}"
    ;`;
  const find_user = await tweet.get(latest_tweete_query);
  const login_user_id = find_user.user_id;

  /////////////////////////////////////
  const get_tweet_query = `
  SELECT
  *
  FROM tweet 
  WHERE
  tweet_id=${tweetId}
  ;`;
  const get_tweet = await tweet.all(get_tweet_query);
  const user_id_following = get_tweet[0].user_id;

  //////////////////////////////////////////////
  const get_name_person_details = `
  SELECT
  user.name,
  user.user_id
  FROM
  follower INNER JOIN user on follower.following_user_id=user.user_id
  WHERE
  follower.follower_user_id=${login_user_id} AND follower.following_user_id=${user_id_following}
  ;`;
  const get_names = await tweet.get(get_name_person_details);

  if (get_names === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const get_tweet_query_ouput = `
  SELECT
  tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id) AS replies,tweet.date_time AS dateTime
  FROM 
  tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id INNER JOIN reply on tweet.tweet_id=reply.tweet_id
  WHERE
  tweet.tweet_id=${tweetId}
  ;`;
    const get_likes_reply = await tweet.get(get_tweet_query_ouput);
    response.send(get_likes_reply);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  auth_middleware_fun,
  async (request, response) => {
    const { tweetId } = request.params;
    const user_name = request.username;
    const latest_tweete_query = `
    SELECT 
    *
    FROM 
    user 
    WHERE
    username="${user_name}"
    ;`;
    const find_user = await tweet.get(latest_tweete_query);
    const login_user_id = find_user.user_id;

    const gettweetquery = `
    SELECT 
    *
    FROM
    tweet 
    WHERE
    tweet.tweet_id=${tweetId}
    ;`;
    const getttweet = await tweet.all(gettweetquery);

    const userFollowersQuery = `
SELECT
*
FROM follower INNER JOIN user on user.user_id = follower.following_user_id
WHERE follower.follower_user_id = ${login_user_id};`;
    const userFollowers = await tweet.all(userFollowersQuery);

    if (
      userFollowers.some((item) => item.following_user_id === getttweet.user_id)
    ) {
      const likesquery = `SELECT
      user.username
      FROM like INNER JOIN user ON like.user_id=user.user_id
      WHERE
      like.tweet_id=${tweeId}

        ;`;
      const likenames = await tweet.all(likesquery);
      console.log(likenames);
      response.send({ likes: likenames });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
