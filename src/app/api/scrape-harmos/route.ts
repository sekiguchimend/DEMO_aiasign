import { NextResponse } from 'next/server';
import { HarmosScraper } from '@/utils/harmosScraper';
import path from 'path';
import fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

export async function POST(request: Request) {
  const scraper = new HarmosScraper();
  let jobListings = [];
  
  try {
    console.log('🚀 スクレイピングを開始します...');
    console.log('🔍 すべての求人情報を取得します');
    
    await scraper.initialize();
    await scraper.login();
    jobListings = await scraper.scrapeJobListings();
    
    // データが取得できた場合のみCSVに出力
    if (jobListings.length > 0) {
      const outputPath = path.join(process.cwd(), 'public', 'harmos_jobs.csv');
      await scraper.exportToCSV(jobListings, outputPath);
    } else {
      console.log('⚠️ 求人データが取得できませんでした。空のCSVファイルを作成します。');
      // 空のCSVファイルを作成
      const outputPath = path.join(process.cwd(), 'public', 'harmos_jobs.csv');
      const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: [
          { id: 'title', title: '求人タイトル' },
          { id: 'url', title: 'URL' },
          { id: 'status', title: 'ステータス' },
          { id: 'lastUpdated', title: '最終更新日' },
          { id: 'companyId', title: '企業ID' },
          { id: 'jobId', title: '求人ID' },
        ],
      });
      await csvWriter.writeRecords([]);
    }
    
    await scraper.close();
    
    return NextResponse.json({ 
      success: true, 
      message: 'スクレイピングが完了しました',
      data: jobListings,
      count: jobListings.length
    });
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    await scraper.close();
    
    // エラーが発生しても空の配列を返す
    return NextResponse.json({ 
      success: false, 
      message: 'スクレイピング中にエラーが発生しました',
      error: error instanceof Error ? error.message : '不明なエラー',
      data: [],
      count: 0
    });
  }
} 