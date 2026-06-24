import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://presencaflow.com';
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/pilot', '/privacy', '/terms'],
      disallow: ['/app/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
