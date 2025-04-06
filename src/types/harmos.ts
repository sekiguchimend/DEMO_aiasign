export interface JobListing {
  title: string;
  url: string;
  status: 'OPEN' | 'CLOSE';
  lastUpdated: string;
  companyId?: string;
  jobId?: string;
} 