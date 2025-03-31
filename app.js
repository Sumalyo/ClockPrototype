require('dotenv').config();
const express = require('express');
const path = require('path');
const CITY = process.env.CITY || 'New York';

const OpenAI =  require('openai');
const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});
const openai = new OpenAI();



// OpenWeather setup using openweather-api-node
const OpenWeather = require('openweather-api-node');
const openWeather = new OpenWeather({
  key: 'a8f32947205d2c0168e3a98b7457b771',
  units: 'metric',
  locationName: CITY,
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as the templating engine and define the views folder
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



// Global variables to store current background image and weather info
let currentBackgroundUrl = null;
let currentWeatherInfo = null;

// Function to get a background image using the OpenAI DALL‑E API
async function getBackgroundImage(prompt = "a scene of the city of Kolkata on a cloudy night with a dry climate in summer. Generate this with a Ghibli style aesthetic") {
  
//const response = await openai.responses.create({
//   model: "gpt-4o",
//   input: "Write a one-sentence bedtime story about a unicorn."
// });

// console.log(response.output_text);
  try {
    // const response = await openai.images.generate({
    //   model: "dall-e-3",
    //   prompt: prompt,
    //   size: "1024x1024"
    // });
    // if (response.data.data && response.data.data.length > 0) {
    //   return response.data.data[0].url;
    // } else {
    //   console.error("Error generating image:", response.data);
    //   return null;
    // }
  return 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-aYev2ALdXUsrBNqHLCD5wtZ0/user-tSuxbLUEOpJDGzxwKqrWo4mE/img-98WGDvfqUGm8xAmbrFXjUUnk.png?st=2025-03-31T06%3A24%3A17Z&se=2025-03-31T08%3A24%3A17Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=d505667d-d6c1-4a0a-bac7-5c84a87759f8&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-03-31T03%3A58%3A40Z&ske=2025-04-01T03%3A58%3A40Z&sks=b&skv=2024-08-04&sig=%2BRGkPkIv3WBs3i/UOSw3dhHRePWi7zd3RxcNbW9/S9Y%3D'
  } 
  catch (error) {
    console.error("Error in getBackgroundImage:", error);
    return null;
  }
}

// // Function to get weather info using openweather-api-node
// async function getWeather(city = CITY) {
//   try {
//     let data = await openWeather.getCurrent()
//       // Current temperature is defined in weatherModel.weather.temp.cur
//       // If you are not sure what is weather model check it out in docs
//       console.log("Current temperature in" +city+ ` is: ${data.weather.temp.cur}\u00B0F`)
// return {
//   temp: data.weather.temp.cur,
//   description: data.weather.description,
//   city: city
// };

//     // openWeather.getCurrentWeather returns a promise
//     //const weatherData = await openWeather.getCurrentWeather({ city: city });
    
//   } catch (error) {
//     console.error("Error in getWeather:", error);
//     return null;
//   }
// }
async function getWeather(city = CITY) {
  try {
    const url = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=a8f32947205d2c0168e3a98b7457b771&units=metric`;
    const response = await fetch(url);
    const data = await response.json();
    if (response.ok) {
      return {
        temp: data.main.temp,
        description: data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1),
        city: city
      };
    } else {
      console.error("Weather API error:", data);
      return null;
    }
  } catch (error) {
    console.error("Error in getWeather:", error);
    return null;
  }
}

// Function to refresh both the background image and weather data
async function refreshData() {
  currentBackgroundUrl = await getBackgroundImage();
  currentWeatherInfo = await getWeather();
}

// Initial data fetch on server start
refreshData();

// Route for the main page
app.get('/', async (req, res) => {
  // Ensure data is available before rendering
  if (!currentBackgroundUrl || !currentWeatherInfo) {
    await refreshData();
  }
  res.render('index', {
    backgroundUrl: currentBackgroundUrl,
    weather: currentWeatherInfo
  });
});

// Refresh endpoint to update the background image and weather data
app.post('/refresh', async (req, res) => {
  await refreshData();
  res.json({
    background_url: currentBackgroundUrl,
    weather: currentWeatherInfo
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
