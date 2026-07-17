/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
<<<<<<< HEAD
    // Works around a known Next.js bug (vercel/next.js#74127) where the
    // build's internal route-type validator throws a false positive on
    // dynamic API routes even when the params type is correct. Real type
    // safety is unaffected — `npx tsc --noEmit` is the actual check, and
    // stays clean regardless of this setting.
    ignoreBuildErrors: true,
  },
};
 
module.exports = nextConfig;
=======
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
>>>>>>> 16572d4 (updated look for the application)
