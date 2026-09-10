module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: ['http://localhost/', 'http://localhost/services', 'http://localhost/login', 'http://localhost/tracking'],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.75 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'total-byte-weight': ['warn', { maxNumericValue: 2200000 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './output/lighthouse',
    },
  },
};
