"use client"
import { useState } from 'react';
import { JobDetail } from '@/types/harmos';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [jobDetails, setJobDetails] = useState<JobDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [csvUrl, setCsvUrl] = useState<string | null>(null);

  const handleScrapeJobDetails = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setCsvUrl(null);
    
    try {
      const response = await fetch('/api/scrape-job-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setJobDetails(data.data);
        setMessage(data.message);
        setCsvUrl('/job-details.csv');
      } else {
        setError(data.message || 'エラーが発生しました');
        setJobDetails([]);
      }
    } catch (err) {
      setError('スクレイピング中にエラーが発生しました');
      setJobDetails([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-900">HRMOS求人詳細スクレイパー</h1>
        
        <div className="bg-white border border-blue-100 rounded-lg p-6 mb-8 shadow-md">
          <div className="flex justify-center mb-6">
            <button
              onClick={handleScrapeJobDetails}
              disabled={isLoading}
              className={`px-6 py-3 rounded-md font-medium text-lg transition-all ${
                isLoading
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-blue-900 hover:bg-blue-800 text-white'
              }`}
            >
              {isLoading ? 'スクレイピング中...' : '全ての求人詳細を取得'}
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
        
        {jobDetails.length > 0 && (
          <div className="space-y-6">
            {jobDetails.map((jobDetail, index) => (
              <div key={index} className="bg-white border border-blue-100 rounded-lg p-6 shadow-md">
                <h2 className="text-xl font-bold mb-4">{jobDetail.title}</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-700">仕事内容</h3>
                    <p className="mt-1 text-gray-600">{jobDetail.description}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700">応募要件</h3>
                    <p className="mt-1 text-gray-600">{jobDetail.requirements}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-gray-700">勤務地</h3>
                      <p className="mt-1 text-gray-600">{jobDetail.workLocation}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">雇用形態</h3>
                      <p className="mt-1 text-gray-600">{jobDetail.employmentType}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">給与</h3>
                      <p className="mt-1 text-gray-600">{jobDetail.salary}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">勤務時間</h3>
                      <p className="mt-1 text-gray-600">{jobDetail.workingHours}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">休日・休暇</h3>
                      <p className="mt-1 text-gray-600">{jobDetail.holidays}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">福利厚生</h3>
                      <p className="mt-1 text-gray-600">{jobDetail.benefits}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">最終更新日: {jobDetail.lastUpdated}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 