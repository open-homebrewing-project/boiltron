var Cylon = require('cylon'),
    fs = require('fs'),
    StatsD = require('node-statsd'),
    client = new StatsD(),
    Twitter = require('twitter'),
    twit = new Twitter({
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
      access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    }),
    celsiusToFahrenheit = function (c) {
      var f = c * 9/5 + 32
      return f;
    }
    parseProbResults = function (data) {
      return (parseInt(data.split("t=")[1])) / 1000;
    };

Cylon.robot({
  probPath: "/home/pi/temp2",
  name: "BoilTron",
  recipe: {
    name: "Weizenbock Halfie",
    url: "https://www.brewtoad.com/recipes/weizenbock-halfie-jz",
    boilTime: 60,
    boilTemp: 212,
    additions: [
      {time: 0, addition: "2.0 oz of Hallertau (DE) Hops"},
      {time: 45, addition: "Whirlfloc Tablet"}
    ]
  },
  notify: {
    name: "@AgentO3"
  },
  currentTemp: 0,
  currentStep: "startup",
  connections: {
    robot: { adaptor: "loopback" }
  },

  work: function(my) {

    //Sample the temp every x seconds
    every((10).seconds(), function(){
      my.sampleTemp(my);


      my.when(my.currentStep === "startup", function(){
          my.robot.emit(my.currentStep);

      });

      my.when(my.currentTemp >= my.recipe.boilTemp && my.currentStep === "heat-water", function(){
          my.robot.emit(my.currentStep);

      });

      client.gauge('boil_temperature', my.currentTemp);

      console.log("Current step is " + my.currentStep);
      console.log("Current temp is " + my.currentTemp);

    });

    my.robot.once("startup", function(){
      my.sendMessage("Starting BoilTron. Wait for water to reach a temp of " + my.recipe.boilTemp + "℉. " + my.notify.name);
      my.currentStep = "heat-water";
    });

    my.robot.once("heat-water", function(){
      my.sendMessage("Water is up to boil temperature of " + my.recipe.boilTemp + "℉. " + my.notify.name);
      my.currentStep = "boil-water";
      my.robot.emit(my.currentStep);
    });

    my.robot.once("boil-water", function(){
      my.sendMessage("Starting boil for " + my.recipe.boilTime
      + "mins. " + my.notify.name);
      after((my.recipe.boilTime * 60).seconds(), function(){
        my.sendMessage("Boil is done. " + my.notify.name);
        my.currentStep = "boil-done";
        my.robot.emit(my.currentStep);
      });

      my.recipe.additions.forEach(function(item){
        after((item.time * 60).seconds(), function(){
          my.sendMessage("Add " + item.addition + " to the boil. "+ my.notify.name);
        });
      });

    });

    my.robot.once("boil-done", function(){
      console.log("Boil process is done shutting down BoilTron.");
      my.sendMessage("Boil process is complete after " + my.recipe.boilTime
      + "mins. " + my.notify.name);
      Cylon.halt();
    });
  },

  when: function(exp, callBack){
    if (exp) {
      callBack()
    };
  },

  sampleTemp: function(my) {
    var data = fs.readFileSync(my.probPath, 'utf8');

    if (data.indexOf("NO") > -1) {
        console.log("Unable to read sensor");
    } else {
      var tempCelsius = parseProbResults(data),
      tempFahrenheit = celsiusToFahrenheit(tempCelsius);

      my.currentTemp = tempFahrenheit;
    }

  },

  sendMessage: function(msg) {
    console.log(msg);
    twit.post('statuses/update', {status: msg},  function(error, params, response){

      if(error) {
        console.log(error)
      }

    });
  },

  sleep: function sleep(ms) {
    var start = Date.now(),
        i;

    while(Date.now() < start + ms) {
      i = 0;
    }
  },
}).start();
