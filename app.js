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
let tweet_db = null;

const connect_to_tweet_DB = async () => {
  try {
    tweet_db = await open({
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
  const get_user = await tweet_db.get(check_user);
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
      const register_user = await tweet_db.run(register_query);
      response.send("User created successfully");
    }
  }
});

//----login
app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  const check_user = `SELECT * FROM user WHERE username="${username}";`;
  const get_user = await tweet_db.get(check_user);
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
    const find_user = await tweet_db.get(latest_tweete_query);
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
    const get_tweets = await tweet_db.all(get_tweets_of_people);
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
  const find_user = await tweet_db.get(latest_tweete_query);
  const login_user_id = find_user.user_id;

  const get_name_person_details = `
  SELECT
  user.name
  FROM
  follower INNER JOIN user on follower.following_user_id=user.user_id
  WHERE
  follower.follower_user_id=${login_user_id}
  ;`;
  const get_names = await tweet_db.all(get_name_person_details);
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
  const find_user = await tweet_db.get(latest_tweete_query);
  const login_user_id = find_user.user_id;
  const followers_query = `
  SELECT
  user.name
  FROM
  follower INNER JOIN user ON follower.follower_user_id=user.user_id
  WHERE 
  follower.following_user_id=${login_user_id}
  ;`;
  const get_followers = await tweet_db.all(followers_query);
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
  const find_user = await tweet_db.get(latest_tweete_query);
  const login_user_id = find_user.user_id;

  ////////////////////////
  const get_tweet_query = `
    SELECT *
    FROM 
    tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id
    WHERE
    tweet.tweet_id=${tweetId} AND follower.follower_user_id=${login_user_id}
    ;`;
  const get_tweet = await tweet_db.get(get_tweet_query);
  //console.log(get_tweet);
  if (get_tweet === undefined) {
    response.send("Invalid Request");
    response.status(401);
  } else {
    const get_my_tweets_query = `SELECT tweet.tweet,COUNT(like.tweet_id) AS likes ,COUNT (reply.tweet_id)AS replies,date_time AS dateTime
    FROM 
    (tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id) AS likestweer INNER JOIN reply ON likestweer.tweet_id=reply.tweet_id
    WHERE
    tweet.tweet_id=${tweetId}
    GROUP BY 
    tweet.tweet_id;`;
    const get_my_tweets = await tweet_db.all(get_my_tweets_query);
    response.send(get_my_tweets[0]);
    //console.log(get_my_tweets);
  }
});
//////api 7
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
    const find_user = await tweet_db.get(latest_tweete_query);
    const login_user_id = find_user.user_id;

    const checktweetuser_query = `
    SELECT *
    FROM 
    tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id
    WHERE
    tweet.tweet_id=${tweetId} AND follower.follower_user_id=${login_user_id}
    ;`;
    const checktweetuser = await tweet_db.get(checktweetuser_query);
    //console.log(checktweetuser);
    if (checktweetuser === undefined) {
      response.send("Invalid Request");
      response.status(401);
    } else {
      const get_likes_query = `SELECT user.username FROM user INNER JOIN like ON user.user_id=like.user_id
        WHERE
        like.tweet_id=${tweetId};`;
      const get_likes = await tweet_db.all(get_likes_query);
      const likes = get_likes.map((user) => {
        return user["username"];
      });
      console.log(likes);
      response.send({ likes: likes });
    }
  }
);
///////api9
app.get("/user/tweets/", auth_middleware_fun, async (request, response) => {
  const user_name = request.username;
  const latest_tweete_query = `
    SELECT 
    *
    FROM 
    user 
    WHERE
    username="${user_name}"
    ;`;
  const find_user = await tweet_db.get(latest_tweete_query);
  const login_user_id = find_user.user_id;

  const getalltweetquery = `
  SELECT 
  tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id)AS replies,tweet.date_time AS dateTime
  FROM ((user INNER JOIN tweet ON user.user_id=tweet.user_id) AS usertweet INNER JOIN like ON like.tweet_id=usertweet.tweet_id) AS likeusertweet INNER JOIN reply ON likeusertweet.tweet_id=reply.tweet_id
  
  WHERE 
  user.user_id=${login_user_id}
  GROUP BY tweet.tweet
  ;`;
  const getalltweetofuser = await tweet_db.all(getalltweetquery);
  response.send(getalltweetofuser);
});

//api10
app.post("/user/tweets/", auth_middleware_fun, async (request, response) => {
  const user_name = request.username;
  const { tweet } = request.body;
  const latest_tweete_query = `
    SELECT 
    *
    FROM 
    user 
    WHERE
    username="${user_name}"
    ;`;
  const find_user = await tweet_db.get(latest_tweete_query);
  const login_user_id = find_user.user_id;
  //console.log(login_user_id, tweet);
  const posttweet_query = `INSERT INTO tweet 
  (tweet)
  VALUES
  ("${tweet}");`;
  const postdatatweet = tweet_db.run(posttweet_query);
  response.send("Created a Tweet");
});

//api11
app.delete(
  "/tweets/:tweetId/",
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
    const find_user = await tweet_db.get(latest_tweete_query);
    const login_user_id = find_user.user_id;
    //console.log(login_user_id);
    const gettweet_of_user_query = `
    SELECT * FROM tweet INNER JOIN user on tweet.user_id=user.user_id
    WHERE 
    tweet.tweet_id=${tweetId} AND user.user_id=${login_user_id}
   
    ;`;
    const gettweet_of_use = await tweet_db.get(gettweet_of_user_query);
    console.log(gettweet_of_use);
    if (gettweet_of_use === undefined) {
      response.send("Invalid Request");
      response.status(401);
    } else {
      const removetweet_query = `
        DELETE FROM tweet WHERE tweet.tweet_id=${tweetId};
        ;`;
      response.send("Tweet Removed");
    }
  }
);

//////////api 8
app.get(
  "/tweets/:tweetId/replies/",
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
    const find_user = await tweet_db.get(latest_tweete_query);
    const login_user_id = find_user.user_id;
    //console.log(login_user_id);
    const isuserfollwing_query = `
  SELECT *
  FROM tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id

  WHERE
  tweet.tweet_id=${tweetId} AND follower.follower_user_id=${login_user_id}
  ;`;
    const isuserfollwing = await tweet_db.get(isuserfollwing_query);
    //console.log(isuserfollwing);
    if (isuserfollwing === undefined) {
      response.send("Invalid Request");
      response.status(401);
    } else {
      const get_replies_of_query = `
      SELECT 
      user.username AS name,reply.reply
      FROM 
     ( tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id) AS replytweet INNER JOIN user ON  replytweet.user_id=user.user_id
      WHERE
      tweet.tweet_id=${tweetId}
      ;`;
      const get_replies_of = await tweet_db.all(get_replies_of_query);
      console.log(get_replies_of);
      response.send({ replies: get_replies_of });
    }
  }
);

module.exports = app;
