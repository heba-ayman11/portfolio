const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

async function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${urlPath}`, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    }).on('error', reject);
  });
}

async function verifyAll() {
  console.log('🧪 VERIFYING PORTFOLIO PROJECTS & ACHIEVEMENTS...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Files on filesystem
  console.log('[1] Checking files on filesystem:');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const scriptJs = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

  assert(fs.existsSync(path.join(__dirname, 'wanderly.png')), 'wanderly.png exists');
  assert(fs.existsSync(path.join(__dirname, 'cherie-care.jpg')), 'cherie-care.jpg exists');
  assert(fs.existsSync(path.join(__dirname, 'ecpc-participant.png')), 'ecpc-participant.png exists');
  assert(fs.existsSync(path.join(__dirname, 'iti-certificate.jpg')), 'iti-certificate.jpg exists');

  // 2. Removal of placeholder projects
  console.log('\n[2] Verifying removal of placeholder projects:');
  assert(!indexHtml.includes('Travel & Exploration Platform'), 'Removed fake "Travel & Exploration Platform"');
  assert(!indexHtml.includes('E-Commerce / Shopify Store'), 'Removed fake "E-Commerce / Shopify Store"');
  assert(!indexHtml.includes('Front-End Web Application'), 'Removed fake "Front-End Web Application"');

  // 3. Wanderly Verification
  console.log('\n[3] Verifying Wanderly project card:');
  assert(indexHtml.includes('Wanderly &mdash; Smart Travel Discovery &amp; Trip Planner') || indexHtml.includes('Wanderly — Smart Travel Discovery & Trip Planner'), 'Wanderly project title present');
  assert(indexHtml.includes('https://wanderly-tau-liard.vercel.app/'), 'Wanderly Live Demo URL present');
  assert(indexHtml.includes('https://github.com/heba-ayman11/ppp'), 'Wanderly GitHub URL present');

  // 4. Chirie Care Verification
  console.log('\n[4] Verifying Chirie Care project card:');
  assert(indexHtml.includes('id="projectChirieCareCard"'), 'Chirie Care card container exists');
  assert(indexHtml.includes('Chirie Care</h3>'), 'Chirie Care title present');
  assert(indexHtml.includes('Shopify E-commerce</span>'), 'Shopify E-commerce badge present');
  assert(indexHtml.includes('Chirie Care is a Shopify-based e-commerce store designed to present products through a clean, organized, and user-friendly shopping experience. The project focuses on storefront presentation, product discovery, and a consistent visual identity.'), 'Chirie Care short description matches exactly');

  // Verify only Shopify tag is present for Chirie Care card
  const chirieCardMatch = indexHtml.match(/id="projectChirieCareCard"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  assert(chirieCardMatch !== null, 'Found Chirie Care card block');
  if (chirieCardMatch) {
    const cardContent = chirieCardMatch[0];
    assert(cardContent.includes('<span class="tag">Shopify</span>'), 'Chirie Care has Shopify tech tag');
    assert(!cardContent.includes('<span class="tag">HTML</span>'), 'Chirie Care does NOT have unverified HTML tag');
    assert(!cardContent.includes('<span class="tag">CSS</span>'), 'Chirie Care does NOT have unverified CSS tag');
    assert(!cardContent.includes('<span class="tag">JavaScript</span>'), 'Chirie Care does NOT have unverified JavaScript tag');
    assert(!cardContent.includes('Live Demo'), 'Chirie Care does NOT have Live Demo button');
    assert(!cardContent.includes('GitHub'), 'Chirie Care does NOT have GitHub button');
    assert(cardContent.includes('View Details'), 'Chirie Care has implemented View Details button');
  }

  // 5. Achievements Verification
  console.log('\n[5] Verifying Achievements cards:');
  assert(indexHtml.includes('id="achievementEcpcCard"'), 'ECPC achievement card present');
  assert(indexHtml.includes('id="achievementItiCard"'), 'ITI achievement card present');
  assert(indexHtml.includes('id="achievementDepiCard"'), 'DEPI achievement card present');
  assert(indexHtml.includes('id="achievementHonorsCard"'), 'Academic Honors achievement card present');
  assert(indexHtml.includes('ecpc-participant.png'), 'ECPC card references ecpc-participant.png');
  assert(indexHtml.includes('iti-certificate.jpg'), 'ITI card references iti-certificate.jpg');
  assert(indexHtml.includes('depi-dotnet.jpg'), 'DEPI card references depi-dotnet.jpg');
  assert(indexHtml.includes('academic-honors.jpg'), 'Academic Honors card references academic-honors.jpg');
  assert(indexHtml.includes('id="imageLightboxModal"'), 'Image lightbox modal present in HTML');
  assert(scriptJs.includes('imageLightboxModal'), 'Script handles image lightbox modal');

  // 6. HTTP Server Verification
  console.log('\n[6] Verifying HTTP Server endpoints:');
  try {
    const homeRes = await get('/');
    assert(homeRes.status === 200, 'GET / returns 200 OK');
    const homeBody = homeRes.body.toString('utf8');
    assert(homeBody.includes('Wanderly'), 'Served HTML includes Wanderly');
    assert(homeBody.includes('Chirie Care'), 'Served HTML includes Chirie Care');

    const cherieImgRes = await get('/cherie-care.jpg');
    assert(cherieImgRes.status === 200 && cherieImgRes.body.length > 200000, 'GET /cherie-care.jpg returns 200 OK with valid image payload');

    const ecpcImgRes = await get('/ecpc-participant.png');
    assert(ecpcImgRes.status === 200 && ecpcImgRes.body.length > 500000, 'GET /ecpc-participant.png returns 200 OK with valid image payload');

    const itiImgRes = await get('/iti-certificate.jpg');
    assert(itiImgRes.status === 200 && itiImgRes.body.length > 50000, 'GET /iti-certificate.jpg returns 200 OK with valid image payload');

    const depiImgRes = await get('/depi-dotnet.jpg');
    assert(depiImgRes.status === 200 && depiImgRes.body.length > 100000, 'GET /depi-dotnet.jpg returns 200 OK with valid image payload');

    const honorsImgRes = await get('/academic-honors.jpg');
    assert(honorsImgRes.status === 200 && honorsImgRes.body.length > 100000, 'GET /academic-honors.jpg returns 200 OK with valid image payload');
  } catch (err) {
    console.error('  ❌ HTTP server check failed:', err.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

verifyAll();
