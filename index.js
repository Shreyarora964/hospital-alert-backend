// const express = require('express');
// const cors = require('cors');
// const puppeteer = require('puppeteer');
// const mongoose = require('mongoose'); // ⬅ Add this
// const bodyParser = require('body-parser'); // ⬅ Add this

// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // ✅ MongoDB connection (local)
// mongoose.connect('mongodb://localhost:27017/hospital_alerts', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// })
// .then(() => console.log("✅ Connected to MongoDB"))
// .catch(err => console.error("❌ MongoDB error:", err));

// // ✅ Mongoose model
// const Alert = mongoose.model('Alert', new mongoose.Schema({
//   name: String,
//   email: String,
//   address: String,
//   createdAt: { type: Date, default: Date.now }
// }));

// // ✅ Alert form POST route
// app.post('/api/alerts', async (req, res) => {
//   try {
//     const { name, email, address } = req.body;
//     const alert = new Alert({ name, email, address });
//     await alert.save();
//     res.json({ status: 'success', message: 'Alert saved successfully!' });
//   } catch (err) {
//     console.error('❌ Error saving alert:', err);
//     res.status(500).json({ status: 'error', message: 'Failed to save alert' });
//   }
// });

// // ✅ Scraping hospitals
// app.get('/api/hospitals', async (req, res) => {
//   try {
//     const browser = await puppeteer.launch({
//       executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
//       headless: false,
//       args: ['--no-sandbox']
//     });

//     const page = await browser.newPage();
//     await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
//     await page.goto('https://www.er-watch.ca', { waitUntil: 'networkidle2' });

//     console.log('⏳ Waiting 10 seconds for hospital cards to render...');
//     await new Promise(resolve => setTimeout(resolve, 8000));

//     const hospitals = await page.evaluate(() => {
//       const cards = document.querySelectorAll('.rounded-xl.bg-white');
//       return Array.from(cards).map(card => {
//         const name = card.querySelector('h1')?.innerText.trim() || 'N/A';

//         const waitTimeSpan = Array.from(card.querySelectorAll('svg'))
//           .find(svg => svg.outerHTML.includes('lucide-clock'))?.parentElement?.querySelector('span');
//         const wait_time = waitTimeSpan?.innerText.trim() || 'N/A';

//         const locationBlock = Array.from(card.querySelectorAll('svg'))
//           .find(svg => svg.outerHTML.includes('lucide-map-pin'))?.parentElement;
//         const location = locationBlock?.innerText.replace('Address:', '').trim() || 'N/A';

//         const infoBlock = Array.from(card.querySelectorAll('svg'))
//           .find(svg => svg.outerHTML.includes('lucide-info'))?.parentElement;
//         const info = infoBlock?.innerText.replace('Info:', '').trim() || 'N/A';

//         const phoneAnchor = Array.from(card.querySelectorAll('a'))
//           .find(a => a.href.startsWith('tel:'));
//         const phone = phoneAnchor ? phoneAnchor.href.replace('tel:', '') : 'N/A';

//         const websiteBlock = Array.from(card.querySelectorAll('a'))
//           .find(a => a.title?.toLowerCase().includes('website') && a.href.startsWith('http'));
//         const website = websiteBlock?.href || 'N/A';

//         const chips = card.querySelectorAll('div.flex.items-center');
//         let waiting = 0;
//         let in_treatment = 0;

//         chips.forEach(chip => {
//           const text = chip?.innerText?.toLowerCase();
//           if (text.includes("waiting")) {
//             waiting = parseInt(text.match(/\d+/)?.[0]) || 0;
//           } else if (text.includes("in treatment")) {
//             in_treatment = parseInt(text.match(/\d+/)?.[0]) || 0;
//           }
//         });

//         return { hospital: name, wait_time, location, info, phone, website, waiting, in_treatment };
//       });
//     });

//     await browser.close();

//     if (!hospitals.length) {
//       return res.status(500).json({
//         status: 'error',
//         message: 'No hospital cards scraped.'
//       });
//     }

//     console.log('✅ Scraped hospital count:', hospitals.length);
//     res.json({ status: 'success', data: hospitals });

//   } catch (error) {
//     console.error('❌ Scraping failed:', error.stack || error.message || error);
//     res.status(500).json({ status: 'error', message: error.message || 'Unknown error' });
//   }
// });

// app.listen(5000, () => {
//   console.log('🚀 Server running at http://localhost:5000');
// });


const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const chromeLauncher = require('chrome-launcher');
const fetch = require('node-fetch');
const nodeFetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection (local)
mongoose.connect('mongodb://localhost:27017/hospital_alerts', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB error:", err));

// Mongoose model
const Alert = mongoose.model('Alert', new mongoose.Schema({
  name: String,
  email: String,
  address: String,
  createdAt: { type: Date, default: Date.now }
}));

// Alert form POST route
app.post('/api/alerts', async (req, res) => {
  try {
    const { name, email, address } = req.body;
    const alert = new Alert({ name, email, address });
    await alert.save();
    res.json({ status: 'success', message: 'Alert saved successfully!' });
  } catch (err) {
    console.error('❌ Error saving alert:', err);
    res.status(500).json({ status: 'error', message: 'Failed to save alert' });
  }
});

// Launch Chrome via chrome-launcher and puppeteer-core
async function getBrowser() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
  const response = await nodeFetch(`http://localhost:${chrome.port}/json/version`);
  const { webSocketDebuggerUrl } = await response.json();
  return puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl });
}

// Scraping hospitals
app.get('/api/hospitals', async (req, res) => {
  try {
    //const browser = await getBrowser();
    const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
         });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.goto('https://www.er-watch.ca', { waitUntil: 'networkidle2' });

    console.log('⏳ Waiting 10 seconds for hospital cards to render...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const hospitals = await page.evaluate(() => {
      const cards = document.querySelectorAll('.rounded-xl.bg-white');
      return Array.from(cards).map(card => {
        const name = card.querySelector('h1')?.innerText.trim() || 'N/A';

        const waitTimeSpan = Array.from(card.querySelectorAll('svg'))
          .find(svg => svg.outerHTML.includes('lucide-clock'))?.parentElement?.querySelector('span');
        const wait_time = waitTimeSpan?.innerText.trim() || 'N/A';

        const locationBlock = Array.from(card.querySelectorAll('svg'))
          .find(svg => svg.outerHTML.includes('lucide-map-pin'))?.parentElement;
        const location = locationBlock?.innerText.replace('Address:', '').trim() || 'N/A';

        const infoBlock = Array.from(card.querySelectorAll('svg'))
          .find(svg => svg.outerHTML.includes('lucide-info'))?.parentElement;
        const info = infoBlock?.innerText.replace('Info:', '').trim() || 'N/A';

        const phoneAnchor = Array.from(card.querySelectorAll('a'))
          .find(a => a.href.startsWith('tel:'));
        const phone = phoneAnchor ? phoneAnchor.href.replace('tel:', '') : 'N/A';

        const websiteBlock = Array.from(card.querySelectorAll('a'))
          .find(a => a.title?.toLowerCase().includes('website') && a.href.startsWith('http'));
        const website = websiteBlock?.href || 'N/A';

        const chips = card.querySelectorAll('div.flex.items-center');
        let waiting = 0;
        let in_treatment = 0;

        chips.forEach(chip => {
          const text = chip?.innerText?.toLowerCase();
          if (text.includes("waiting")) {
            waiting = parseInt(text.match(/\d+/)?.[0]) || 0;
          } else if (text.includes("in treatment")) {
            in_treatment = parseInt(text.match(/\d+/)?.[0]) || 0;
          }
        });

        return { hospital: name, wait_time, location, info, phone, website, waiting, in_treatment };
      });
    });

    await browser.close();

    if (!hospitals.length) {
      return res.status(500).json({
        status: 'error',
        message: 'No hospital cards scraped.'
      });
    }

    console.log('✅ Scraped hospital count:', hospitals.length);
    res.json({ status: 'success', data: hospitals });

  } catch (error) {
    console.error('❌ Scraping failed:', error.stack || error.message || error);
    res.status(500).json({ status: 'error', message: error.message || 'Unknown error' });
  }
});

app.listen(5000, () => {
  console.log('🚀 Server running at http://localhost:5000');
});




// const express = require('express');
// const cors = require('cors');
// const puppeteer = require('puppeteer');
// const fetch = require('node-fetch');

// const app = express();
// app.use(cors());

// const OPENCAGE_API_KEY = '1968bf7e652a4bbcbdc91a780dea0541';

// async function geocodeAddress(address) {
//   const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${OPENCAGE_API_KEY}&limit=1`;
//   const response = await fetch(url);
//   const data = await response.json();

//   if (data.results && data.results.length > 0) {
//     return {
//       lat: data.results[0].geometry.lat,
//       lng: data.results[0].geometry.lng,
//     };
//   } else {
//     return { lat: null, lng: null };
//   }
// }

// app.get('/api/hospitals', async (req, res) => {
//   try {
//     const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
//     const page = await browser.newPage();

//     await page.setUserAgent("Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36");
//     await page.goto('https://www.er-watch.ca', { waitUntil: 'networkidle2' });
//     await new Promise(resolve => setTimeout(resolve, 8000));

//     const hospitals = await page.evaluate(() => {
//       const rows = document.querySelectorAll('table tbody tr');
//       return Array.from(rows).map(row => {
//         const cols = row.querySelectorAll('td');
//         return {
//           hospital: cols[0]?.innerText.trim(),
//           wait_time: cols[1]?.innerText.trim(),
//           location: cols[2]?.innerText.trim(),
//           phone: cols[3]?.innerText.trim(),
//           website: cols[4]?.innerText.trim()
//         };
//       });
//     });

//     await browser.close();

//     // Add geolocation to each hospital
//     const hospitalsWithGeo = await Promise.all(
//       hospitals.map(async hosp => {
//         const geo = await geocodeAddress(hosp.location);
//         return { ...hosp, ...geo };
//       })
//     );

//     res.json({ status: 'success', data: hospitalsWithGeo });
//   } catch (error) {
//     console.error('❌ Error:', error.stack || error.message);
//     res.status(500).json({ status: 'error', message: error.message });
//   }
// });

// app.listen(5000, () => console.log('🚀 Server running at http://localhost:5000'));
