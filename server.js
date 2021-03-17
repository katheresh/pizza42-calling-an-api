const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const { join } = require("path");
const authConfig = require("./auth_config.json");
var axios = require("axios").default;
const request = require("request");

const app = express();

if (!authConfig.domain || !authConfig.audience) {
    throw "Please make sure that auth_config.json is in place and populated";
}

app.use(morgan("dev"));
app.use(helmet());
app.use(express.static(join(__dirname, "public")));

const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`
    }),

    audience: authConfig.audience,
    issuer: `https://${authConfig.domain}/`,
    algorithms: ["RS256"]
});

/*app.get("/api/external", checkJwt, (req, res) => {
    //app.get("/authorized", checkJwt, (req, res) => {
    res.send({
        msg: "Your access token was successfully validated!"
    });
});*/


/**
 * Executes the trigger Auth0 user profile flow
 */
app.get("/api/external", checkJwt, (req, res) => {
    try {
        let userEmail = req.query.userid;
        console.log("userID value got from query string-->" + userEmail);
        var options = {
            method: 'POST',
            url: 'https://dev-whr8fx91.au.auth0.com/oauth/token',
            headers: { 'content-type': 'application/json' },
            body: '{"client_id":"nXa5YpD1y1JHvYi2hbSHxpIdVez4qmLh","client_secret":"Q5xzii-SmNbcRmTYTzvZGREVjXusVkU07DR75LTlLQsYSY4CaLoYD1rvfFz_t1mk","audience":"https://dev-whr8fx91.au.auth0.com/api/v2/","grant_type":"client_credentials"}'
        };
        request(options, function(error, response, body) {
            if (error) throw new Error(error);
            console.log("response for clientCredentials Access token-->" + body);
            var obj = JSON.parse(body);
            var m2mToken = obj.access_token;
            console.log("m2mToken--->" + m2mToken);
            console.log("userEmail--->" + userEmail);
            var options_readprofile = {
                method: 'GET',
                //url: 'https://dev-whr8fx91.au.auth0.com/api/v2/users/auth0|604b5fcd0fcc230069ac4371',
                url: 'https://dev-whr8fx91.au.auth0.com/api/v2/users-by-email?email=' + userEmail,
                headers: { authorization: `Bearer ${m2mToken}`, 'content-type': 'application/json' },
                scope: 'read:users'
            };
            axios.request(options_readprofile).then(function(response) {
                console.log(response.data);
                console.log('extracted user_id--->', response.data[0].user_id);
                let userID = response.data[0].user_id;
                console.log("userID--->" + userID);
                //this section calls to update the user with preference
                var options_userprofile = {
                    method: 'PATCH',
                    //url: 'https://dev-whr8fx91.au.auth0.com/api/v2/users/auth0|604b5fcd0fcc230069ac4371',
                    url: 'https://dev-whr8fx91.au.auth0.com/api/v2/users/' + userID,
                    headers: { authorization: `Bearer ${m2mToken}`, 'content-type': 'application/json' },
                    scope: 'update:current_user_metadata',
                    data: { user_metadata: { pizza: '2 Large Tandoori Pizza', drink: '1 - 1.2L Drink', side: '1 - Large Fries', hobby: 'Tennis1' } }
                };

                axios.request(options_userprofile).then(function(responseUserProfile) {
                    console.log("responseUserProfile-->" + responseUserProfile.data);
                }).catch(function(error) {
                    console.error(error);
                });
            }).catch(function(error) {
                console.error(error);
            });
        });

    } catch (err) {
        console.log("Error updating UserProfile at line 95!!!!!!!", err);
        return;
    }
    res.send({
        msg: "Your order is successfully placed!!!!!!!!!"
    });
});

app.get("/auth_config.json", (req, res) => {
    res.sendFile(join(__dirname, "auth_config.json"));
});

app.get("/*", (req, res) => {
    res.sendFile(join(__dirname, "index.html"));
});

app.use(function(err, req, res, next) {
    if (err.name === "UnauthorizedError") {
        return res.status(401).send({ msg: "Invalid token" });
    }

    next(err, req, res);
});

process.on("SIGINT", function() {
    process.exit();
});






module.exports = app;