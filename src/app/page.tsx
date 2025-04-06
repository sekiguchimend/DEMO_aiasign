"use client"
import { useState } from 'react';
import { JobListing } from '@/types/harmos';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [jobListings, setJobListings] = useState<JobListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [csvUrl, setCsvUrl] = useState<string | null>(null);

  const handleScrape = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setCsvUrl(null);
    
    try {
      const response = await fetch('/api/scrape-harmos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setJobListings(data.data || []);
        setMessage(data.message);
        setCsvUrl('/harmos_jobs.csv');
      } else {
        setError(data.message || 'エラーが発生しました');
        setJobListings([]);
      }
    } catch (err) {
      setError('スクレイピング中にエラーが発生しました');
      setJobListings([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-900">HRMOS求人情報スクレイパー</h1>
        
        <div className="bg-white border border-blue-100 rounded-lg p-6 mb-8 shadow-md">
          <div className="flex justify-center mb-6">
            <button
              onClick={handleScrape}
              disabled={isLoading}
              className={`px-6 py-3 rounded-md font-medium text-lg transition-all ${
                isLoading
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-blue-900 hover:bg-blue-800 text-white'
              }`}
            >
              {isLoading ? 'スクレイピング中...' : '求人情報を取得'}
            </button>
          </div>
          
          {message && (
            <div className="text-center mb-4 p-3 bg-green-50 text-green-800 rounded-md border border-green-100">
              {message}
            </div>
          )}
          
          {error && (
            <div className="text-center mb-4 p-3 bg-red-50 text-red-800 rounded-md border border-red-100">
              {error}
            </div>
          )}
          
          {csvUrl && (
            <div className="text-center">
              <a
                href={csvUrl}
                download
                className="inline-block px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-md transition-colors"
              >
                CSVファイルをダウンロード
              </a>
            </div>
          )}
        </div>
        
        <div className="bg-white border border-blue-100 rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-blue-900">取得した求人情報</h2>
          
          {jobListings.length > 0 ? (
            <div className="space-y-4">
              {jobListings.map((job, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <h3 className="text-xl font-medium mb-2 text-blue-900">{job.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">ステータス:</span>{' '}
                      <span className={job.status === 'OPEN' ? 'text-green-600' : 'text-red-600'}>
                        {job.status === 'OPEN' ? '募集中' : '募集終了'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">最終更新日:</span> {job.lastUpdated}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-gray-700">URL:</span>{' '}
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:underline break-all"
                      >
                        {job.url}
                      </a>
                    </div>
                    {job.companyId && (
                      <div>
                        <span className="font-medium text-gray-700">企業ID:</span> {job.companyId}
                      </div>
                    )}
                    {job.jobId && (
                      <div>
                        <span className="font-medium text-gray-700">求人ID:</span> {job.jobId}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {isLoading ? (
                <p>求人情報を取得中です...</p>
              ) : (
                <p>求人情報がありません。上記のボタンをクリックして取得してください。</p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 