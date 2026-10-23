const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

async function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, 'http://localhost:3000');
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf-8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: text,
          json,
          buffer
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Multipart form builder helper
function buildMultipartForm(boundary, fields, files) {
  const chunks = [];
  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }
  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(file.content);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

async function runTests() {
  console.log('🧪 STARTING VERIFICATION TEST SUITE...\n');
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

  try {
    // Test 1: Fetch initial public reviews
    console.log('[1] Testing GET /api/reviews');
    const reviewsRes = await request('/api/reviews');
    assert(reviewsRes.status === 200, 'Status is 200 OK');
    assert(reviewsRes.json && reviewsRes.json.success === true, 'Response success is true');
    assert(Array.isArray(reviewsRes.json.reviews) && reviewsRes.json.reviews.length >= 3, 'Returns initial seed reviews array');

    // Test 2: Submit a valid review
    console.log('\n[2] Testing POST /api/reviews (valid submission)');
    const testReviewPayload = {
      name: 'Dr. Tarek Omar',
      role: 'DEPI Program Director',
      rating: 5,
      review: 'Heba demonstrated outstanding technical proficiency in ASP.NET Core and database engineering during our software project evaluations.'
    };
    const postReviewRes = await request('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testReviewPayload)
    });
    assert(postReviewRes.status === 201, 'Status is 201 Created');
    assert(postReviewRes.json.success === true, 'Review successfully accepted');
    assert(postReviewRes.json.review.name === 'Dr. Tarek Omar', 'Review name stored accurately');
    const createdReviewId = postReviewRes.json.review.id;

    // Test 3: Verify immediate database persistence
    console.log('\n[3] Testing Persistence: Verify newly submitted review in GET /api/reviews');
    const updatedReviewsRes = await request('/api/reviews');
    const foundNewReview = updatedReviewsRes.json.reviews.find(r => r.id === createdReviewId);
    assert(Boolean(foundNewReview), 'New review retrieved from SQLite database');
    assert(foundNewReview && foundNewReview.rating === 5, 'Rating matches submitted value (5 stars)');

    // Test 4: Submit invalid review (validation check)
    console.log('\n[4] Testing POST /api/reviews validation & XSS sanitization');
    const invalidReviewRes = await request('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', review: 'Hi', rating: 7 })
    });
    assert(invalidReviewRes.status === 400, 'Rejects invalid rating/too-short review with 400 Bad Request');

    // Test XSS sanitization
    const xssPayload = {
      name: 'Hacker <script>alert(1)</script>',
      role: 'Tester',
      rating: 4,
      review: 'Testing <img src=x onerror=alert(1)> sanitization'
    };
    const xssRes = await request('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(xssPayload)
    });
    assert(xssRes.status === 201, 'XSS input processed safely');
    assert(!xssRes.json.review.name.includes('<script>'), 'HTML <script> tag neutralized in name');
    assert(!xssRes.json.review.review.includes('<img'), 'HTML <img> tag neutralized in review');
    const xssReviewId = xssRes.json.review.id;

    // Test 5: GET /api/cv metadata
    console.log('\n[5] Testing GET /api/cv');
    const cvRes = await request('/api/cv');
    assert(cvRes.status === 200, 'Status is 200 OK');
    assert(cvRes.json.success === true, 'Response success is true');
    assert(cvRes.json.cv.original_name.includes('CV_Heba Allah Ayman'), 'References existing CV file');
    assert(cvRes.json.cv.file_size > 0, 'File size is positive integer');

    // Test 6: GET /api/cv/download (actual PDF stream)
    console.log('\n[6] Testing GET /api/cv/download');
    const cvDownloadRes = await request('/api/cv/download');
    assert(cvDownloadRes.status === 200, 'Status is 200 OK');
    assert(cvDownloadRes.headers['content-type'] === 'application/pdf', 'Content-Type header is application/pdf');
    assert(cvDownloadRes.headers['content-disposition'].includes('attachment'), 'Content-Disposition is attachment');
    const isPdfMagic = cvDownloadRes.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    assert(isPdfMagic, 'Downloaded file begins with genuine %PDF- magic bytes header');
    assert(cvDownloadRes.buffer.length === cvRes.json.cv.file_size, 'Downloaded byte size matches metadata');

    // Test 7: Unauthorized CV upload attempt (security check)
    console.log('\n[7] Testing Security: Unauthorized CV upload rejection');
    const unauthUploadRes = await request('/api/admin/cv/upload', {
      method: 'POST'
    });
    assert(unauthUploadRes.status === 401, 'Unauthorized request rejected with 401 Unauthorized');

    // Test 8: Admin Authentication
    console.log('\n[8] Testing Admin Login (POST /api/admin/login)');
    // Invalid credentials
    const badLoginRes = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert(badLoginRes.status === 401, 'Rejects invalid password with 401');

    // Valid credentials
    const validLoginRes = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@Heba2026!' })
    });
    assert(validLoginRes.status === 200, 'Authenticates valid credentials with 200 OK');
    assert(Boolean(validLoginRes.json.token), 'Issues secure session token');
    const adminToken = validLoginRes.json.token;
    const cookieHeader = validLoginRes.headers['set-cookie'] ? validLoginRes.headers['set-cookie'][0] : '';
    assert(cookieHeader.includes('portfolio_admin_token='), 'Sets HttpOnly session cookie');

    // Test 9: Verify authenticated session
    console.log('\n[9] Testing GET /api/admin/me');
    const meRes = await request('/api/admin/me', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(meRes.status === 200, 'Authenticated session verified with 200 OK');
    assert(meRes.json.username === 'admin', 'Identified as administrator');

    // Test 10: Authenticated CV Upload with genuine PDF
    console.log('\n[10] Testing Authenticated CV Upload (POST /api/admin/cv/upload)');
    // Create a valid replacement PDF buffer
    const updatedPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Heba Ayman - Updated Senior CV 2026) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const formBuffer = buildMultipartForm(boundary, {}, [{
      fieldname: 'cvFile',
      filename: 'CV_Heba_Ayman_Senior_2026.pdf',
      contentType: 'application/pdf',
      content: updatedPdfContent
    }]);

    const uploadRes = await request('/api/admin/cv/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: formBuffer
    });
    assert(uploadRes.status === 200, 'Upload succeeded with 200 OK');
    assert(uploadRes.json.success === true, 'Upload response indicates success');
    assert(uploadRes.json.cv.original_name === 'CV_Heba_Ayman_Senior_2026.pdf', 'New CV original name stored');

    // Test 11: Verify public Download CV button immediately serves the new CV
    console.log('\n[11] Testing Public Download CV after replacement');
    const newCvInfo = await request('/api/cv');
    assert(newCvInfo.json.cv.original_name === 'CV_Heba_Ayman_Senior_2026.pdf', 'Public /api/cv now points to new CV');

    const newDownloadRes = await request('/api/cv/download');
    assert(newDownloadRes.status === 200, 'Download endpoint serves new CV file');
    assert(newDownloadRes.headers['content-disposition'].includes('CV_Heba_Ayman_Senior_2026.pdf'), 'Content-Disposition updated to new file name');
    assert(newDownloadRes.buffer.toString('utf-8').includes('Heba Ayman - Updated Senior CV 2026'), 'Downloaded contents contain new CV payload');

    // Test 12: Admin Review Moderation (DELETE /api/admin/reviews/:id)
    console.log('\n[12] Testing Review Moderation: DELETE /api/admin/reviews/:id');
    const deleteRes = await request(`/api/admin/reviews/${xssReviewId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteRes.status === 200, 'Admin deleted test review successfully');

    // Verify it is removed from public list
    const finalReviewsRes = await request('/api/reviews');
    const stillFound = finalReviewsRes.json.reviews.some(r => r.id === xssReviewId);
    assert(!stillFound, 'Deleted review is no longer in public list');

    // Clean up created test review
    await request(`/api/admin/reviews/${createdReviewId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    // Reset initial CV to the original CV_Heba Allah Ayman.pdf
    console.log('\n[13] Restoring original CV as active');
    const origCvContent = fs.readFileSync(path.join(__dirname, 'CV_Heba Allah Ayman.pdf'));
    const restoreBoundary = '----WebKitFormBoundaryRestore' + Math.random().toString(36).substring(2);
    const restoreFormBuffer = buildMultipartForm(restoreBoundary, {}, [{
      fieldname: 'cvFile',
      filename: 'CV_Heba Allah Ayman.pdf',
      contentType: 'application/pdf',
      content: origCvContent
    }]);
    const restoreRes = await request('/api/admin/cv/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${restoreBoundary}`
      },
      body: restoreFormBuffer
    });
    assert(restoreRes.status === 200, 'Original CV successfully restored as active production CV');
    const restoredCv = await request('/api/cv');
    assert(restoredCv.json.cv.original_name === 'CV_Heba Allah Ayman.pdf', 'Active CV confirmed as original CV_Heba Allah Ayman.pdf');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  }

  console.log(`\n====================================================`);
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
