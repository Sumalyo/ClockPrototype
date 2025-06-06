require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const fetch = require('node-fetch');
const { createWriteStream } = require('fs');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
//const fs = require("fs").promises;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('backgrounds'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const BACKGROUND_FOLDER = path.join(__dirname, 'backgrounds');
const DEFAULT_IMAGE = 'default.png';
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
const DATABASE_PATH = path.join(__dirname, 'database.json');
// const CITY = 'Kolkata'; // Removed hardcoded city
const OPENWEATHER_API_KEY = process.env['WEATHER_API_KEY'];

let currentBackgroundFile = DEFAULT_IMAGE;
let currentWeatherInfo = null;

function generatePrompt(settings, database) {
  const prompt = `A ${settings["Picture Style"].toLowerCase()} style image of ${database.city} in the ${database.timeOfDay.toLowerCase()} on a ${database.Weather.toLowerCase()} day.`;
  console.log("Generated prompt:", prompt);
  return prompt;
}

async function readJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    console.log(`Read JSON from ${filePath}`);
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return {};
  }
}

async function writeJson(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Wrote JSON to ${filePath}`);
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e);
  }
}

async function downloadImage(imageBase64, filename) {
  const filePath = path.join(BACKGROUND_FOLDER, filename);
  //console.log(`Downloading image to ${filePath} from ${url}`);
  console.log("Decodding image")
  //const res = await fetch(url);
  const buffer = Buffer.from(imageBase64, "base64");
  await fs.writeFile(filePath, buffer);
  console.log(`✅ Image saved: ${filePath}`);
  return filePath;
  //const stream = createWriteStream(filePath);

  // return new Promise((resolve, reject) => {
  //   res.body.pipe(stream);
  //   res.body.on('error', reject);
  //   stream.on('finish', () => {
  //     console.log(`Image download completed: ${filename}`);
  //     resolve(filename);
  //   });
  // });
}

async function getBackgroundImage(prompt) {
  try {
    console.log("Requesting image generation from OpenAI...");
    const response = await openai.images.generate({
      model: "gpt-image-1", // set the image model accordingly
      prompt,
      quality:"low",
      size: "1536x1024" // update the size
    }); // update this to latest API

    // const imageUrl = response.data[0].url;
    // console.log("Image URL received:", imageUrl);
    //console.log(response.data)
    const imageBase64 = response.data[0].b64_json;
    console.log("Image base 64 recieved");
    const filename = `bg_${Date.now()}.png`;
    await downloadImage(imageBase64, filename);
    return filename;
    //return DEFAULT_IMAGE;
  } catch (error) {
    console.error("Image generation error:", error);
    return DEFAULT_IMAGE;
  }
}

async function getWeather(city) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    console.log("Fetching weather from OpenWeather API for:", city);
    const response = await fetch(url);
    const data = await response.json();
    if (response.ok) {
      console.log("Weather data received:", data);
      return {
        temp: data.main.temp,
        description: data.weather[0].description,
        city: city,
        weatherMain: data.weather[0].main
      };
    }
    console.error("Weather API response not ok:", data);
    return null;
  } catch (error) {
    console.error("Weather error:", error);
    return null;
  }
}
// modify with weather codes

async function refreshData(forceImage = false) {
  // improve prompt generation with weather code and more exciting settings
  console.log("\nRefreshing data...");
  const settings = await readJson(SETTINGS_PATH);
  const database = await readJson(DATABASE_PATH);
  const weather = await getWeather(settings.location);

  if (weather) {
    currentWeatherInfo = {
      temp: weather.temp,
      description: weather.description.charAt(0).toUpperCase() + weather.description.slice(1),
      city: weather.city
    };

    const now = new Date();
    const hours = now.getHours();
    database.timeOfDay = hours >= 5 && hours < 18 ? 'Day' : 'Night';
    database.Weather = weather.weatherMain;
    database.city = settings.location;
    database["Date of recording"] = now.toLocaleDateString();

    await writeJson(DATABASE_PATH, database);

    const currentHour = now.getHours();
    if (forceImage || [0, 6, 12, 18].includes(currentHour)) {
      console.log("Generating new background image...");
      const prompt = generatePrompt(settings, database);
      const newImage = await getBackgroundImage(prompt);
      currentBackgroundFile = newImage;
    } else {
      console.log("No image generation required at this time.");
    }
  } else {
    console.log("Weather data unavailable, skipping image generation.");
  }
}

setInterval(() => {
  console.log("\nScheduled refresh triggered.");
  refreshData(false);
}, 1.5 * 60 * 60 * 1000);

refreshData(true);

app.get('/', async (req, res) => {
  console.log("GET / request received");
  if (!currentBackgroundFile || !currentWeatherInfo || currentBackgroundFile === DEFAULT_IMAGE) {
    console.log("Initial background is default, triggering forced refresh...");
    await refreshData(true);
  }
  const moment = require('moment-timezone');
  const timezoneData = await readJson(path.join(__dirname, 'timezones.json'));
  const timezone = timezoneData[currentWeatherInfo.city] || 'Etc/UTC';
  //console.log(timezone)
  const offsetMinutes = moment.tz(timezone).utcOffset();
  const offsetMinutesoperator = moment.tz('Asia/Kolkata').utcOffset();
  const offsetMinutesRelative = offsetMinutes-offsetMinutesoperator
  //console.log()

  res.render('index', {
    backgroundUrl: '/' + currentBackgroundFile,
    weather: currentWeatherInfo,
    utcOffset: offsetMinutesRelative
  });
});

app.get('/settings.json', async (req, res) => {
  res.sendFile(path.join(__dirname, 'settings.json'));
});

app.post('/refresh', async (req, res) => {
  console.log("POST /refresh request received");
  await refreshData(true);
  const moment = require('moment-timezone');
  const timezoneData = await readJson(path.join(__dirname, 'timezones.json'));
  const timezone = timezoneData[currentWeatherInfo.city] || 'Etc/UTC';
  const offsetMinutes = moment.tz(timezone).utcOffset();
  const offsetMinutesoperator = moment.tz('Asia/Kolkata').utcOffset();
  const offsetMinutesRelative = offsetMinutes-offsetMinutesoperator
  console.log(offsetMinutesRelative)
  res.json({
    background_url: '/' + currentBackgroundFile,
    weather: currentWeatherInfo,
    utcOffset: offsetMinutesRelative // Not a true world clock as this effect does not take effect
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
