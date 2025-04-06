import { NextApiRequest, NextApiResponse } from 'next';
import { HarmosScraper } from '@/utils/harmosScraper';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const scraper = new HarmosScraper();
    await scraper.initialize();
    process.env.HRMOS_EMAIL = username;
    process.env.HRMOS_PASSWORD = password;
    await scraper.login();
    
    const jobListings = await scraper.scrapeJobListings();
    
    const outputPath = path.join(process.cwd(), 'public', 'job-listings.csv');
    await scraper.exportToCSV(jobListings, outputPath);
    
    await scraper.close();

    return res.status(200).json({ 
      message: 'Scraping completed successfully',
      filePath: '/job-listings.csv'
    });
  } catch (error) {
    console.error('Scraping error:', error);
    return res.status(500).json({ message: 'Error during scraping' });
  }
} 