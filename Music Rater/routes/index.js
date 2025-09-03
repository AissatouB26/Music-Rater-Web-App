const https = require('https')
const sqlite3 = require('sqlite3').verbose() 
const db = new sqlite3.Database('data/db_1200iRealSongs')
const express = require('express')
const router = express.Router()

// Authentication Middleware using session
exports.authenticate = function(request, response, next) {
  if (request.session && request.session.user) {
    next();  
  } else {
    response.redirect('/login')  
  }
}

// Render the login page
exports.loginPage = function(request, response) {
  response.render('login') 
}

// Handle login logic
exports.loginUser = function(request, response) {
  const { username, password } = request.body

  db.all("SELECT userid, password, role FROM users WHERE userid = ?", [username], function(err, rows) {
    if (err || rows.length === 0 || rows[0].password !== password) {
      return response.redirect('/login') 
    } else {
      // Create session for logged-in user
      request.session.user = { id: rows[0].userid, role: rows[0].role }
      return response.redirect('/home')  
    }
  })
}

// Render the signup page
exports.signupPage = function(request, response) {
  response.render('signup')  
}

// Handle signup logic
exports.signupUser = function(request, response) {
  const { username, password} = request.body
  db.run("INSERT INTO users (userid, password, role) VALUES (?, ?, ?)", [username, password, "guest"], function(err) {
    if (err) {
      return response.redirect('/signup')  
    } else {
      return response.redirect('/login') 
    }
  })
}

//Displays home page
exports.home = function(request, response) {
  response.render('home');
}

//Uses the Itunes API to search or songs and displays them as search results
exports.searchSong = function(request, response) {
  const song = request.query.song;
  console.log(song)

  const titleWithPlusSigns = song.split(' ').join('+')
  console.log(titleWithPlusSigns)
  

  const options = {
    method: 'GET',
    hostname: 'itunes.apple.com',
    port: null,
    path: `/search?term=${titleWithPlusSigns}&entity=musicTrack`,
    headers: {
      'useQueryString': true
    }
  };

  https.request(options, function (apiResponse) {
    let songData = ''

    apiResponse.on('data', function (chunk) {
      songData += chunk
    });

    apiResponse.on('end', function () {
      const parsedData = JSON.parse(songData)
      let sortedData = [];

      //Filters search results for duplicates
      for(let i = 0; i < parsedData.results.length; i++){
        let duplicate = false
        for(let j = 0; j < sortedData.length; j++){
          if(parsedData.results[i].artistName === sortedData[j].artistName && parsedData.results[i].trackName === sortedData[j].trackName){
            duplicate = true
            break
          }
        }
        if(!duplicate){
          sortedData.push(parsedData.results[i])
        }
      }
      response.render('searchResults', {
        title: `Songs matching: ${song}`,
        songs: sortedData
      });
    });
  }).end();
}

//Displays the song page and user reviews
exports.songPage = function(request, response){
  const trackId = request.params.id

  //Finds the song with Itunes API
   const options = {
    method: 'GET',
    hostname: 'itunes.apple.com',
    path: `/lookup?id=${trackId}`,
    headers: {
      'useQueryString': true
    }
  };

  https.request(options, function(apiResponse) {
    let songData = ''

    apiResponse.on('data', chunk => {
      songData += chunk
    });

    apiResponse.on('end', () => {
      const parsedData = JSON.parse(songData)
      
      if (parsedData.results && parsedData.results.length > 0) {
        const song = parsedData.results[0]

        // Fetch reviews for the song from your database
        db.all("SELECT users.userid, reviews.rating FROM reviews JOIN users ON reviews.userid = users.userid WHERE reviews.songId = ?", [trackId], function(err, rows) {
          if (err) {
            console.error("Error fetching reviews:", err.message);
            return response.status(500).render('error', { message: 'Error fetching reviews' });
          }

          //Displays the song and reviews
          response.render('songPage', { 
            song, 
            reviews: rows 
          });
        });
      } else {
        response.status(404).render('error', { message: 'Song not found' });
      }
    });
  }).end();
}

//Submit user reviews and save them to the database
exports.submitReview = function(request, response){
  const { rating, songId } = request.body
  const userid = request.session.user?.id

  if (!userid) {
    return response.status(401).send("You must be logged in to submit a review.")
  }

  if (!rating || !songId) {
    return response.status(400).send("Missing rating or song ID.")
  }

  const query = "INSERT INTO reviews (userid, songId, rating) VALUES (?, ?, ?)";
  db.run(query, [userid, songId, rating], function(err) {
    if (err) {
      console.error("Error inserting review:", err.message);
      return response.status(500).send("Error saving review.")
    }

    response.redirect('/song/' + songId)
  });
}

//Allows admin to access a list of all registered users
exports.viewUsers = function(request, response) {
  if (request.session.user && request.session.user.role === 'admin') {
    db.all("SELECT userid, role FROM users", function(err, rows) {
      if (err) {
        console.error("Error fetching users:", err.message);
        return response.status(500).render('error', { message: 'Error fetching users' });
      }
      response.render('adminViewUsers', { users: rows });
    });
  } else {
    return response.status(403).render('error', { message: 'Access denied' });
  }
};
