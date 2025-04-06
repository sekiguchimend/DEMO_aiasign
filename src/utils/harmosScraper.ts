import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';

interface JobListing {
  title: string;
  url: string;
  status: 'OPEN' | 'CLOSE';
  lastUpdated: string;
  companyId?: string;
  jobId?: string;
}

interface CandidateInfo {
  name: string;
  url: string;
  jobCategory: string;
  jobDescription: string;
  requirements: string;
  lastUpdated: string;
  companyId: string;
  jobId: string;
  candidateId: string;
  candidateDetailId: string;
}

interface CandidateUrlInfo {
  url: string;
  candidateId: string;
  candidateDetailId: string;
}

interface CandidateTableInfo {
  [key: string]: string;
}

interface JobUrlInfo {
  url: string;
  jobId: string;
}

export class HarmosScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    console.log('🚀 ブラウザを初期化しています...');
    try {
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
      this.page = await this.browser.newPage();
      
      // ユーザーエージェントを設定
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // タイムアウトを設定
      this.page.setDefaultTimeout(60000);
      
      // リクエストのブロックを設定
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        // 画像、フォント、メディアなどのリソースをブロックして高速化
        if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // JavaScriptの実行を有効化
      await this.page.setJavaScriptEnabled(true);
      
      // ページの読み込みを待機する関数を設定
      this.page.on('load', () => {
        console.log('📄 ページの読み込みが完了しました');
      });
      
      console.log('✅ ブラウザの初期化が完了しました');
    } catch (error) {
      console.error('❌ ブラウザの初期化中にエラーが発生しました:', error);
      throw error;
    }
  }

  async login() {
    if (!this.page) throw new Error('Browser not initialized');

    const email = process.env.HRMOS_EMAIL;
    const password = process.env.HRMOS_PASSWORD;

    if (!email || !password) {
      console.error('❌ ログイン情報が設定されていません');
      throw new Error('HRMOS login credentials are not set in environment variables');
    }

    console.log('🔑 ログイン処理を開始します...');
    console.log('📝 アクセス先: https://hrmos.co/agent/corporates');

    try {
      // 直接企業一覧ページにアクセス
      await this.page.goto('https://hrmos.co/agent/corporates', { waitUntil: 'networkidle0', timeout: 30000 });
      console.log(`📍 現在のURL: ${this.page.url()}`);

      // ログインページにリダイレクトされた場合の処理
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login')) {
        console.log('🔒 ログインページにリダイレクトされました。ログインを実行します...');
        
        // ログインフォームが表示されるまで待機
        await this.page.waitForSelector('input[name="email"]', { timeout: 10000 });
        await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });
        
        // ログイン情報を入力
        await this.page.type('input[name="email"]', email);
        await this.page.type('input[name="password"]', password);
        
        // ログインボタンをクリック
        await this.page.click('button[type="submit"]');
        
        // ログイン後のページ遷移を待機
        await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
        
        console.log(`📍 ログイン後のURL: ${this.page.url()}`);
        
        // ログイン成功の確認
        if (this.page.url().includes('/login')) {
          console.error('❌ ログインに失敗しました。ログイン情報が正しくないか、ボット検出に引っかかっている可能性があります。');
          // ログイン失敗を無視して続行
          console.log('⚠️ ログイン失敗を無視して続行します...');
        } else {
          console.log('✅ ログインが完了しました');
        }
      } else {
        console.log('✅ すでにログイン済みです');
      }
    } catch (error) {
      console.error('❌ ログイン処理中にエラーが発生しました:', error);
      // エラーを無視して続行
      console.log('⚠️ ログインエラーを無視して続行します...');
    }
  }

  async scrapeJobListings(): Promise<JobListing[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 求人情報のスクレイピングを開始します...');
    const jobListings: JobListing[] = [];
    
    try {
      // 企業一覧ページにアクセス
      const url = 'https://hrmos.co/agent/corporates';
      
      console.log(`📝 アクセス先: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      console.log(`📍 現在のURL: ${this.page.url()}`);
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 求人一覧ページの要素を待機
      console.log('⏳ 求人一覧の要素を待機中...');
      try {
        // Angularのコンポーネント構造に対応するセレクタを試す
        const selectors = [
          '.ng-star-inserted',
          '[class*="ng-tns-c"]',
          '[class*="ng-star-inserted"]',
          '.job-listing',
          '.job-card',
          '.job-item',
          '.job',
          'article',
          '.list-item',
          'a[href*="/jobs/"]',
          'div[class*="ng-"]',
          'div[class*="job"]',
          'div[class*="list"]',
          'div[class*="card"]'
        ];
        
        let foundSelector = '';
        for (const selector of selectors) {
          console.log(`🔍 セレクタ "${selector}" を試しています...`);
          try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            foundSelector = selector;
            console.log(`✅ セレクタ "${selector}" が見つかりました`);
            break;
          } catch (error) {
            console.log(`⚠️ セレクタ "${selector}" が見つかりませんでした`);
          }
        }
        
        if (!foundSelector) {
          console.warn('⚠️ 求人一覧の要素が見つかりませんでした。ページの構造が変更された可能性があります。');
          console.log('🔍 ページのHTMLを確認します...');
          const pageContent = await this.page.content();
          console.log(`📄 ページのHTML: ${pageContent.substring(0, 500)}...`);
          
          
          return [];
        }
      } catch (error) {
        console.warn('⚠️ 求人一覧の要素が見つかりませんでした。ページの構造が変更された可能性があります。');
        console.log('🔍 ページのHTMLを確認します...');
        const pageContent = await this.page.content();
        console.log(`📄 ページのHTML: ${pageContent.substring(0, 500)}...`);
        
        return [];
      }

      // 求人リンクを取得 - Angularのコンポーネント構造に対応
      console.log('🔍 求人リンクを検索中...');
      
      // まず、ng-star-insertedクラスを持つ要素を取得
      const ngStarElements = await this.page.$$('.ng-star-inserted');
      console.log(`📊 ng-star-inserted要素数: ${ngStarElements.length}件`);
      
      // 次に、ng-tns-cで始まるクラスを持つ要素を取得
      const ngTnsElements = await this.page.$$('[class*="ng-tns-c"]');
      console.log(`📊 ng-tns-c要素数: ${ngTnsElements.length}件`);
      
      // 求人リンクを取得
      const jobLinks = await this.page.$$('a[href*="/jobs/"]');
      console.log(`📊 求人リンク数: ${jobLinks.length}件`);
      
      // すべての要素を結合
      const allElements = [...ngStarElements, ...ngTnsElements, ...jobLinks];
      console.log(`📊 合計要素数: ${allElements.length}件`);
      
      if (allElements.length === 0) {
        console.warn('⚠️ 求人要素が見つかりませんでした。');
        return [];
      }
      
      // 各要素から情報を取得
      for (let i = 0; i < allElements.length; i++) {
        const element = allElements[i];
        try {
          console.log(`\n🔍 要素 ${i+1}/${allElements.length} の情報を取得中...`);
          
          // 要素のHTMLを取得して確認
          const elementHtml = await element.evaluate((el: Element) => el.outerHTML);
          console.log(`🔍 要素のHTML: ${elementHtml.substring(0, 100)}...`);
          
          // URLを取得
          let url = '';
          try {
            // 要素自体がリンクか、子要素にリンクがあるかを確認
            if (elementHtml.includes('href="/jobs/')) {
              url = await element.evaluate((el: Element) => {
                if (el instanceof HTMLAnchorElement) {
                  return el.href;
                } else {
                  const link = el.querySelector('a[href*="/jobs/"]');
                  return link ? (link as HTMLAnchorElement).href : '';
                }
              });
              console.log(`🔗 URL: ${url}`);
            } else {
              console.log('⚠️ この要素には求人リンクが含まれていません');
              continue; // 次の要素へ
            }
          } catch (error) {
            console.warn(`⚠️ URLの取得に失敗しました: ${error}`);
            continue; // 次の要素へ
          }
          
          // URLから企業IDと求人IDを抽出
          let companyId = '';
          let jobId = '';
          try {
            const urlParts = url.split('/');
            const jobsIndex = urlParts.indexOf('jobs');
            if (jobsIndex !== -1 && jobsIndex > 0) {
              companyId = urlParts[jobsIndex - 1];
              if (jobsIndex + 1 < urlParts.length) {
                jobId = urlParts[jobsIndex + 1];
              }
            }
            console.log(`🏢 企業ID: ${companyId}, 求人ID: ${jobId}`);
          } catch (error) {
            console.warn(`⚠️ IDの抽出に失敗しました: ${error}`);
          }
          
          // タイトルを取得
          let title = '';
          try {
            title = await element.evaluate((el: Element) => {
              // 要素自体がリンクの場合
              if (el instanceof HTMLAnchorElement) {
                return el.textContent || '';
              } 
              // 子要素にリンクがある場合
              const link = el.querySelector('a[href*="/jobs/"]');
              if (link) {
                return link.textContent || '';
              }
              // それ以外の場合は要素のテキストを返す
              return el.textContent || '';
            });
            console.log(`📌 タイトル: ${title.trim()}`);
          } catch (error) {
            console.warn(`⚠️ タイトルの取得に失敗しました: ${error}`);
            title = 'タイトル不明';
          }
          
          // ステータスを取得
          let status = 'UNKNOWN';
          try {
            // 要素のテキストからステータスを判断
            const elementText = await element.evaluate((el: Element) => el.textContent || '');
            status = elementText.includes('募集中') ? 'OPEN' : 'CLOSE';
            console.log(`📊 ステータス: ${status}`);
          } catch (error) {
            console.warn(`⚠️ ステータスの取得に失敗しました: ${error}`);
          }
          
          // 最終更新日を取得
          let lastUpdated = '';
          try {
            // 要素内の日付を探す
            const dateText = await element.evaluate((el: Element) => {
              // 日付っぽいテキストを探す
              const text = el.textContent || '';
              const dateMatch = text.match(/\d{4}\/\d{1,2}\/\d{1,2}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}日/);
              return dateMatch ? dateMatch[0] : '';
            });
            
            if (dateText) {
              lastUpdated = dateText.trim();
              console.log(`🕒 最終更新日: ${lastUpdated}`);
            } else {
              lastUpdated = '更新日不明';
            }
          } catch (error) {
            console.warn('⚠️ 最終更新日の取得に失敗しました: ${error}');
            lastUpdated = '更新日不明';
          }

          // 重複チェック - 同じURLの求人が既に追加されているか確認
          const isDuplicate = jobListings.some(job => job.url === url);
          if (isDuplicate) {
            console.log('⚠️ この求人は既に追加されています。スキップします。');
            continue;
          }

          jobListings.push({
            title: title.trim(),
            url,
            status: status as 'OPEN' | 'CLOSE',
            lastUpdated: lastUpdated.trim(),
            companyId,
            jobId
          });
          console.log('✅ 求人情報の取得が完了しました');
        } catch (error) {
          console.error('❌ 要素 ${i+1}/${allElements.length} の情報取得中にエラーが発生しました:', error);
          // エラーが発生しても処理を継続
          continue;
        }
      }
    } catch (error) {
      console.error('❌ スクレイピング中にエラーが発生しました:', error);
      // エラーが発生しても空の配列を返す
      return [];
    }

    console.log(`\n📊 合計 ${jobListings.length} 件の求人情報を取得しました`);
    return jobListings;
  }

  async exportToCSV(jobListings: JobListing[], outputPath: string) {
    console.log('\n💾 CSVファイルに出力しています...');
    console.log(`📁 出力先: ${outputPath}`);
    
    try {
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

      await csvWriter.writeRecords(jobListings);
      console.log('✅ CSVファイルの出力が完了しました');
    } catch (error) {
      console.error('❌ CSVファイルの出力中にエラーが発生しました:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      console.log('🔒 ブラウザを終了しています...');
      try {
        await this.browser.close();
        console.log('✅ ブラウザを終了しました');
      } catch (error) {
        console.error('❌ ブラウザの終了中にエラーが発生しました:', error);
      }
    }
  }
  async getClassInfo(url: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    
    console.log(`🔍 企業情報を取得します: ${url}`);
    
    try {
      // 指定されたURLにアクセス
      await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      console.log(`📍 現在のURL: ${this.page.url()}`);
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // ページのHTMLを確認
      console.log('🔍 ページのHTMLを確認します...');
      const pageContent = await this.page.content();
      console.log(`📄 ページのHTML: ${pageContent.substring(0, 500)}...`);
      
      // ページのスクリーンショットを保存
      await this.page.screenshot({ path: 'company-info-screenshot.png', fullPage: true });
      console.log('📸 ページのスクリーンショットを保存しました: company-info-screenshot.png');
      
      // 企業情報を取得
      console.log('🔍 企業情報を取得中...');
      
      // 企業名を取得
      let companyName = '';
      try {
        const nameElement = await this.page.$('h1, .company-name, .name, [class*="company-name"], [class*="name"]');
        if (nameElement) {
          companyName = await nameElement.evaluate(el => el.textContent || '');
          console.log(`🏢 企業名: ${companyName.trim()}`);
        } else {
          console.log('⚠️ 企業名が見つかりませんでした');
        }
      } catch (error) {
        console.error('❌ 企業名の取得中にエラーが発生しました:', error);
      }
      
      // 企業URLを取得
      const companyUrl = this.page.url();
      console.log(`🔗 企業URL: ${companyUrl}`);
      
      // 企業の説明を取得
      let companyDescription = '';
      try {
        const descriptionElement = await this.page.$('.description, [class*="description"], .company-description, [class*="company-description"], .content, [class*="content"]');
        if (descriptionElement) {
          companyDescription = await descriptionElement.evaluate(el => el.textContent || '');
          console.log(`📝 企業の説明: ${companyDescription.trim().substring(0, 100)}...`);
        } else {
          console.log('⚠️ 企業の説明が見つかりませんでした');
        }
      } catch (error) {
        console.error('❌ 企業の説明の取得中にエラーが発生しました:', error);
      }
      
      // 企業の住所を取得
      let companyAddress = '';
      try {
        const addressElement = await this.page.$('.address, [class*="address"], .location, [class*="location"]');
        if (addressElement) {
          companyAddress = await addressElement.evaluate(el => el.textContent || '');
          console.log(`📍 企業の住所: ${companyAddress.trim()}`);
        } else {
          console.log('⚠️ 企業の住所が見つかりませんでした');
        }
      } catch (error) {
        console.error('❌ 企業の住所の取得中にエラーが発生しました:', error);
      }
      
      // 企業の業種を取得
      let companyIndustry = '';
      try {
        const industryElement = await this.page.$('.industry, [class*="industry"], .business, [class*="business"]');
        if (industryElement) {
          companyIndustry = await industryElement.evaluate(el => el.textContent || '');
          console.log(`🏭 企業の業種: ${companyIndustry.trim()}`);
        } else {
          console.log('⚠️ 企業の業種が見つかりませんでした');
        }
      } catch (error) {
        console.error('❌ 企業の業種の取得中にエラーが発生しました:', error);
      }
      
      // 企業の従業員数を取得
      let companyEmployees = '';
      try {
        const employeesElement = await this.page.$('.employees, [class*="employees"], .staff, [class*="staff"], .size, [class*="size"]');
        if (employeesElement) {
          companyEmployees = await employeesElement.evaluate(el => el.textContent || '');
          console.log(`👥 企業の従業員数: ${companyEmployees.trim()}`);
        } else {
          console.log('⚠️ 企業の従業員数が見つかりませんでした');
        }
      } catch (error) {
        console.error('❌ 企業の従業員数の取得中にエラーが発生しました:', error);
      }
      
      // 結果を整形
      let result = '企業情報:\n\n';
      result += `企業名: ${companyName.trim()}\n`;
      result += `URL: ${companyUrl}\n`;
      result += `説明: ${companyDescription.trim()}\n`;
      result += `住所: ${companyAddress.trim()}\n`;
      result += `業種: ${companyIndustry.trim()}\n`;
      result += `従業員数: ${companyEmployees.trim()}\n`;
      
      return result;
    } catch (error: any) {
      console.error('❌ 企業情報の取得中にエラーが発生しました:', error);
      return `エラーが発生しました: ${error.message}`;
    }
  }

  async scrapeAllCandidateInfo(): Promise<CandidateInfo[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 すべての候補者情報のスクレイピングを開始します...');
    const candidateInfos: CandidateInfo[] = [];
    
    try {
      // 企業一覧ページにアクセス
      const url = 'https://hrmos.co/agent/corporates';
      
      console.log(`📝 アクセス先: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      console.log(`📍 現在のURL: ${this.page.url()}`);
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // まず、hrm-nav-listを探す
      console.log('⏳ hrm-nav-listを探しています...');
      try {
        await this.page.waitForSelector('hrm-nav-list', { timeout: 10000 });
        console.log('✅ hrm-nav-listが見つかりました');
        
        // hrm-nav-list内の要素を取得
        const navListItems = await this.page.$$('hrm-nav-list a[href*="/corporates/"]');
        console.log(`📊 hrm-nav-list内の企業リンク数: ${navListItems.length}件`);
        
        if (navListItems.length === 0) {
          console.warn('⚠️ hrm-nav-list内に企業リンクが見つかりませんでした。別の方法を試みます。');
        } else {
          // hrm-nav-listから企業情報を取得
          const companyUrls: {url: string; companyId: string}[] = [];
          
          for (let i = 0; i < navListItems.length; i++) {
            try {
              const href = await navListItems[i].evaluate(el => (el as HTMLAnchorElement).href);
              const urlParts = href.split('/');
              const corporatesIndex = urlParts.indexOf('corporates');
              let companyId = '';
              if (corporatesIndex !== -1 && corporatesIndex + 1 < urlParts.length) {
                companyId = urlParts[corporatesIndex + 1];
              }
              
              if (companyId) {
                companyUrls.push({url: href, companyId});
                console.log(`🏢 企業URL取得: ${href}, ID: ${companyId}`);
              }
            } catch (error) {
              console.warn(`⚠️ 企業URLの取得に失敗しました: ${error}`);
            }
          }
          
          // 各企業の求人情報を取得
          for (let i = 0; i < companyUrls.length; i++) {
            const {url, companyId} = companyUrls[i];
            try {
              console.log(`\n🔍 企業 ${i+1}/${companyUrls.length} の情報を取得中...`);
              console.log(`🏢 企業ID: ${companyId}`);
              
              // 企業の求人一覧ページにアクセス
              const jobsUrl = `https://hrmos.co/agent/corporates/${companyId}/jobs`;
              console.log(`📝 求人一覧ページにアクセス: ${jobsUrl}`);
              await this.page.goto(jobsUrl, { waitUntil: 'networkidle0', timeout: 30000 });
              
              // ページの読み込みが完了するまで待機
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // 求人一覧ページでhrm-nav-listを探す
              console.log('⏳ 求人一覧ページでhrm-nav-listを探しています...');
              try {
                await this.page.waitForSelector('hrm-nav-list', { timeout: 10000 });
                console.log('✅ 求人一覧ページでhrm-nav-listが見つかりました');
                
                // hrm-nav-list内の求人リンクを取得
                const jobNavItems = await this.page.$$('hrm-nav-list a[href*="/jobs/"]');
                console.log(`📊 hrm-nav-list内の求人リンク数: ${jobNavItems.length}件`);
                
                if (jobNavItems.length === 0) {
                  console.warn('⚠️ hrm-nav-list内に求人リンクが見つかりませんでした。別の方法を試みます。');
                } else {
                  // hrm-nav-listから求人情報を取得
                  const jobUrls: {url: string; jobId: string}[] = [];
                  
                  for (let j = 0; j < jobNavItems.length; j++) {
                    try {
                      const href = await jobNavItems[j].evaluate(el => (el as HTMLAnchorElement).href);
                      const urlParts = href.split('/');
                      const jobsIndex = urlParts.indexOf('jobs');
                      let jobId = '';
                      if (jobsIndex !== -1 && jobsIndex + 1 < urlParts.length) {
                        jobId = urlParts[jobsIndex + 1];
                      }
                      
                      if (jobId) {
                        jobUrls.push({url: href, jobId});
                        console.log(`💼 求人URL取得: ${href}, ID: ${jobId}`);
                      }
                    } catch (error) {
                      console.warn(`⚠️ 求人URLの取得に失敗しました: ${error}`);
                    }
                  }
                  
                  // 各求人ページを個別に処理
                  for (let j = 0; j < jobUrls.length; j++) {
                    const {url: jobUrl, jobId} = jobUrls[j];
                    try {
                      console.log(`\n🔍 求人 ${j+1}/${jobUrls.length} の情報を取得中...`);
                      console.log(`💼 求人ID: ${jobId}`);
                      
                      // 求人詳細ページにアクセス
                      console.log(`📝 求人詳細URL取得: ${jobUrl}, ID: ${jobId}`);
                      await this.page.goto(jobUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                      
                      // ページの読み込みが完了するまで待機
                      await new Promise(resolve => setTimeout(resolve, 5000));
                      
                      // 求人詳細ページでhrm-nav-listを探す
                      console.log('⏳ 求人詳細ページでhrm-nav-listを探しています...');
                      try {
                        await this.page.waitForSelector('hrm-nav-list', { timeout: 10000 });
                        console.log('✅ 求人詳細ページでhrm-nav-listが見つかりました');
                        
                        // hrm-nav-list内の候補者リンクを取得
                        const candidateNavItems = await this.page.$$('hrm-nav-list a[href*="/candidates/"]');
                        console.log(`📊 hrm-nav-list内の候補者リンク数: ${candidateNavItems.length}件`);
                        
                        if (candidateNavItems.length === 0) {
                          console.warn('⚠️ hrm-nav-list内に候補者リンクが見つかりませんでした。別の方法を試みます。');
                          
                          // ng-tns-c144-11 ng-star-insertedクラスを持つ要素を探す
                          console.log('⏳ ng-tns-c144-11 ng-star-insertedクラスを持つ要素を探しています...');
                          try {
                            await this.page.waitForSelector('.ng-tns-c144-11.ng-star-inserted', { timeout: 10000 });
                            console.log('✅ ng-tns-c144-11 ng-star-insertedクラスを持つ要素が見つかりました');
                            
                            // ng-tns-c144-11 ng-star-insertedクラスを持つ要素を取得
                            const candidateElements = await this.page.$$('.ng-tns-c144-11.ng-star-inserted');
                            console.log(`📊 ng-tns-c144-11 ng-star-insertedクラスを持つ要素数: ${candidateElements.length}件`);
                            
                            if (candidateElements.length === 0) {
                              console.warn('⚠️ ng-tns-c144-11 ng-star-insertedクラスを持つ要素が見つかりませんでした。');
                              continue;
                            }
                            
                            // 各候補者要素からリンクを取得
                            const candidateUrls: CandidateUrlInfo[] = [];
                            
                            for (let k = 0; k < candidateElements.length; k++) {
                              try {
                                const candidateElement = candidateElements[k];
                                
                                // 要素内のa[_ngcontent-oes-c144]要素を取得
                                const linkElements = await candidateElement.$$('a[_ngcontent-oes-c144]');
                                
                                for (let l = 0; l < linkElements.length; l++) {
                                  const linkElement = linkElements[l];
                                  const href = await linkElement.evaluate((el: HTMLAnchorElement) => el.getAttribute('href'));
                                  if (!href) {
                                    console.warn(`⚠️ リンク ${l+1} のhref属性が見つかりませんでした`);
                                    continue;
                                  }
                                  const urlParts = href.split('/');
                                  const candidatesIndex = urlParts.indexOf('candidates');
                                  let candidateId = '';
                                  let candidateDetailId = '';
                                  if (candidatesIndex !== -1 && candidatesIndex + 1 < urlParts.length) {
                                    candidateId = urlParts[candidatesIndex + 1];
                                    if (candidatesIndex + 2 < urlParts.length) {
                                      candidateDetailId = urlParts[candidatesIndex + 2];
                                    }
                                  }
                                  
                                  if (candidateId) {
                                    const candidateUrlInfo: CandidateUrlInfo = {
                                      url: href,
                                      candidateId,
                                      candidateDetailId
                                    };
                                    candidateUrls.push(candidateUrlInfo);
                                    console.log(`👤 候補者URL取得: ${href}, ID: ${candidateId}, 詳細ID: ${candidateDetailId}`);
                                  }
                                }
                              } catch (error) {
                                console.warn(`⚠️ 候補者要素 ${k+1} のリンク取得に失敗しました:`, error);
                              }
                            }
                            
                            // 各候補者ページを個別に処理
                            for (let k = 0; k < candidateUrls.length; k++) {
                              const {url: candidateUrl, candidateId, candidateDetailId} = candidateUrls[k];
                              try {
                                console.log(`\n🔍 候補者 ${k+1}/${candidateUrls.length} の情報を取得中...`);
                                console.log(`👤 候補者ID: ${candidateId}, 詳細ID: ${candidateDetailId}`);
                                
                                // 候補者詳細ページにアクセス
                                console.log(`📝 候補者詳細ページにアクセス: ${candidateUrl}`);
                                await this.page.goto(candidateUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                                
                                // ページの読み込みが完了するまで待機
                                await new Promise(resolve => setTimeout(resolve, 5000));
                                
                                // 候補者情報を取得
                                const candidates = await this.scrapeCandidateInfo(companyId, jobId);
                                candidateInfos.push(...candidates);
                                console.log('✅ 候補者情報の取得が完了しました');
                              } catch (error) {
                                console.error(`❌ 候補者 ${k+1}/${candidateUrls.length} の情報取得中にエラーが発生しました:`, error);
                                continue;
                              }
                            }
                          } catch (error) {
                            console.warn('⚠️ ng-tns-c144-11 ng-star-insertedクラスを持つ要素が見つかりませんでした。');
                            continue;
                          }
                        } else {
                          // hrm-nav-listから候補者情報を取得
                          const candidateUrls: CandidateUrlInfo[] = [];
                          
                          for (let k = 0; k < candidateNavItems.length; k++) {
                            try {
                              const href = await candidateNavItems[k].evaluate((el: HTMLAnchorElement) => el.getAttribute('href'));
                              if (!href) {
                                console.warn(`⚠️ 候補者 ${k+1} のhref属性が見つかりませんでした`);
                                continue;
                              }
                              const urlParts = href.split('/');
                              const candidatesIndex = urlParts.indexOf('candidates');
                              let candidateId = '';
                              let candidateDetailId = '';
                              if (candidatesIndex !== -1 && candidatesIndex + 1 < urlParts.length) {
                                candidateId = urlParts[candidatesIndex + 1];
                                if (candidatesIndex + 2 < urlParts.length) {
                                  candidateDetailId = urlParts[candidatesIndex + 2];
                                }
                              }
                              
                              if (candidateId) {
                                const candidateUrlInfo: CandidateUrlInfo = {
                                  url: href,
                                  candidateId,
                                  candidateDetailId
                                };
                                candidateUrls.push(candidateUrlInfo);
                                console.log(`👤 候補者URL取得: ${href}, ID: ${candidateId}, 詳細ID: ${candidateDetailId}`);
                              }
                            } catch (error) {
                              console.warn(`⚠️ 候補者URLの取得に失敗しました: ${error}`);
                            }
                          }
                          
                          // 各候補者ページを個別に処理
                          for (let k = 0; k < candidateUrls.length; k++) {
                            const {url: candidateUrl, candidateId, candidateDetailId} = candidateUrls[k];
                            try {
                              console.log(`\n🔍 候補者 ${k+1}/${candidateUrls.length} の情報を取得中...`);
                              console.log(`👤 候補者ID: ${candidateId}, 詳細ID: ${candidateDetailId}`);
                              
                              // 候補者詳細ページにアクセス
                              console.log(`📝 候補者詳細ページにアクセス: ${candidateUrl}`);
                              await this.page.goto(candidateUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                              
                              // ページの読み込みが完了するまで待機
                              await new Promise(resolve => setTimeout(resolve, 5000));
                              
                              // 候補者情報を取得
                              const candidates = await this.scrapeCandidateInfo(companyId, jobId);
                              candidateInfos.push(...candidates);
                              console.log('✅ 候補者情報の取得が完了しました');
                            } catch (error) {
                              console.error(`❌ 候補者 ${k+1}/${candidateUrls.length} の情報取得中にエラーが発生しました:`, error);
                              continue;
                            }
                          }
                        }
                      } catch (error) {
                        console.warn('⚠️ 求人詳細ページでhrm-nav-listが見つかりませんでした。');
                        continue;
                      }
                    } catch (error) {
                      console.error(`❌ 求人 ${j+1}/${jobUrls.length} の情報取得中にエラーが発生しました:`, error);
                      continue;
                    }
                  }
                }
              } catch (error) {
                console.warn('⚠️ 求人一覧ページでhrm-nav-listが見つかりませんでした。別の方法を試みます。');
              }
            } catch (error) {
              console.error(`❌ 企業 ${i+1}/${companyUrls.length} の情報取得中にエラーが発生しました:`, error);
              continue;
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ hrm-nav-listが見つかりませんでした。別の方法を試みます。');
      }
    } catch (error) {
      console.error('❌ 候補者情報のスクレイピング中にエラーが発生しました:', error);
      return [];
    }

    console.log(`\n📊 合計 ${candidateInfos.length} 件の候補者情報を取得しました`);
    return candidateInfos;
  }

  async scrapeCandidateInfo(companyId: string, jobId: string): Promise<CandidateInfo[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 候補者情報のスクレイピングを開始します...');
    const candidates: CandidateInfo[] = [];

    try {
      // 求人詳細ページのURLを構築（候補者一覧を含む）
      const url = `https://hrmos.co/agent/corporates/${companyId}/jobs/${jobId}/candidates`;
      console.log(`📝 アクセス先: ${url}`);
      
      await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      console.log(`📍 現在のURL: ${this.page.url()}`);
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // デバッグ用：現在のページのHTMLを取得
      const html = await this.page.content();
      console.log('📄 現在のページのHTML:', html);

      // app-applicationsコンポーネントを待機
      console.log('⏳ app-applicationsコンポーネントを探しています...');
      await this.page.waitForSelector('app-applications[class*="ng-tns-c144"]', { timeout: 10000 });

      // hrm-nav-list-user-itemを待機
      console.log('⏳ hrm-nav-list-user-itemを探しています...');
      await this.page.waitForSelector('hrm-nav-list-user-item[class*="ng-tns-c144"]', { timeout: 10000 });

      // 候補者リンクを取得
      const candidateElements = await this.page.$$('hrm-nav-list-user-item[class*="ng-tns-c144"] a[_ngcontent-dsh-c144]');
      console.log(`📊 候補者要素数: ${candidateElements.length}件`);

      if (candidateElements.length === 0) {
        console.log('⚠️ 候補者リンクが見つかりませんでした。別の方法を試みます...');
        
        // より一般的なセレクタを試す
        const alternativeSelectors = [
          'app-applications a[href*="/candidates/"]',
          'hrm-pane a[href*="/candidates/"]',
          'hrm-nav-list a[href*="/candidates/"]',
          '.ng-star-inserted a[href*="/candidates/"]',
          'a[href*="/candidates/"]'
        ];

        for (const selector of alternativeSelectors) {
          console.log(`🔍 代替セレクタを試行中: ${selector}`);
          const elements = await this.page.$$(selector);
          if (elements.length > 0) {
            console.log(`✅ ${elements.length}件の候補者リンクを発見しました`);
            for (const element of elements) {
              try {
                const href = await element.evaluate(el => (el as HTMLAnchorElement).getAttribute('href'));
                if (!href) continue;
                const text = await element.evaluate(el => (el as HTMLElement).textContent?.trim() || '');
                console.log(`🔗 リンク: ${href}`);
                console.log(`📝 テキスト: ${text}`);
              } catch (error) {
                console.warn('⚠️ リンク情報の取得に失敗しました:', error);
              }
            }
          }
        }

        // スクリーンショットを保存
        await this.page.screenshot({ path: 'debug-candidates.png', fullPage: true });
        console.log('📸 デバッグ用にスクリーンショットを保存しました: debug-candidates.png');
        return [];
      }

      for (let i = 0; i < candidateElements.length; i++) {
        try {
          const element = candidateElements[i];
          
          // href属性を取得
          const href = await element.evaluate(el => (el as HTMLAnchorElement).getAttribute('href'));
          if (!href) {
            console.warn(`⚠️ 候補者 ${i + 1} のhref属性が見つかりませんでした`);
            continue;
          }

          // テキストコンテンツを取得（候補者名）
          const name = await element.evaluate(el => (el as HTMLElement).textContent?.trim() || '');
          
          // URLからIDを抽出
          const urlParts = href.split('/');
          const candidateId = urlParts[urlParts.length - 2] || '';
          const candidateDetailId = urlParts[urlParts.length - 1] || '';

          // 候補者詳細ページのURLを構築
          const candidateUrl = `https://hrmos.co/agent/corporates/${companyId}/jobs/${jobId}/candidates/${candidateId}/${candidateDetailId}`;
          console.log(`📝 候補者詳細ページにアクセス: ${candidateUrl}`);
          
          await this.page.goto(candidateUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 3000));

          // 詳細情報を取得
          console.log('🔍 詳細情報を取得中...');

          // 詳細情報のセレクタパターン
          const detailPatterns = {
            table: [
              'table[_ngcontent-dsh-c147]',
              'table.candidate-details',
              'hrm-card-section table'
            ],
            row: [
              'tr',
              '.table-row'
            ]
          };

          let rows: ElementHandle<Element>[] = [];
          for (const tablePattern of detailPatterns.table) {
            for (const rowPattern of detailPatterns.row) {
              const selector = `${tablePattern} ${rowPattern}`;
              console.log(`🔍 詳細テーブルのセレクタ "${selector}" を試行中...`);
              rows = await this.page.$$(selector);
              if (rows.length > 0) break;
            }
            if (rows.length > 0) break;
          }

          const info: { [key: string]: string } = {
            jobCategory: '',
            jobDescription: '',
            requirements: '',
            lastUpdated: ''
          };

          // 各行から情報を取得
          for (const row of rows) {
            try {
              const cells = await row.$$('td, th');
              if (cells.length < 2) continue;

              const label = await cells[0].evaluate(el => (el as HTMLElement).textContent?.trim() || '');
              const value = await cells[1].evaluate(el => (el as HTMLElement).textContent?.trim() || '');

              // ラベルに基づいて適切なフィールドに値を設定
              switch (label) {
                case '職種分類':
                case '職種':
                  info.jobCategory = value;
                  break;
                case '業務内容':
                case '仕事内容':
                  info.jobDescription = value;
                  break;
                case '応募要件':
                case '必要スキル':
                  info.requirements = value;
                  break;
                case '最終更新日':
                case '更新日':
                  info.lastUpdated = value;
                  break;
              }
            } catch (error) {
              console.warn('⚠️ テーブルの行の解析に失敗しました:', error);
            }
          }

          const candidateInfo: CandidateInfo = {
            name,
            url: candidateUrl,
            jobCategory: info.jobCategory,
            jobDescription: info.jobDescription,
            requirements: info.requirements,
            lastUpdated: info.lastUpdated,
            companyId,
            jobId,
            candidateId,
            candidateDetailId
          };

          candidates.push(candidateInfo);
          console.log(`✅ 候補者 ${i + 1} の情報を取得: ${name} (${candidateId})`);
        } catch (error) {
          console.warn(`⚠️ 候補者 ${i + 1} の情報取得に失敗しました:`, error);
        }
      }

      console.log(`✅ 合計 ${candidates.length} 件の候補者情報を取得しました`);
      return candidates;
    } catch (error) {
      console.error('❌ 候補者情報の取得中にエラーが発生しました:', error);
      throw error;
    }
  }

  async exportCandidateInfoToCSV(candidateInfos: CandidateInfo[], outputPath: string) {
    console.log('\n💾 候補者情報をCSVファイルに出力しています...');
    console.log(`📁 出力先: ${outputPath}`);
    
    try {
      const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: [
          { id: 'name', title: '候補者名' },
          { id: 'url', title: 'URL' },
          { id: 'jobCategory', title: '職種分類' },
          { id: 'jobDescription', title: '業務内容' },
          { id: 'requirements', title: '応募要件' },
          { id: 'lastUpdated', title: '最終更新日' },
          { id: 'companyId', title: '企業ID' },
          { id: 'jobId', title: '求人ID' },
          { id: 'candidateId', title: '候補者ID' },
          { id: 'candidateDetailId', title: '候補者詳細ID' },
        ],
      });

      await csvWriter.writeRecords(candidateInfos);
      console.log('✅ CSVファイルの出力が完了しました');
    } catch (error) {
      console.error('❌ CSVファイルの出力中にエラーが発生しました:', error);
      throw error;
    }
  }

  async scrapeTableContent(url: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 テーブル内容のスクレイピングを開始します...');
    
    try {
      // 指定されたURLにアクセス
      console.log(`📝 アクセス先: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      console.log(`📍 現在のURL: ${this.page.url()}`);
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // tbody要素を待機
      console.log('⏳ tbody要素を探しています...');
      await this.page.waitForSelector('tbody[_ngcontent-oes-c147]', { timeout: 10000 });
      
      // tbody内のすべての行を取得
      const rows = await this.page.$$('tbody[_ngcontent-oes-c147] tr');
      console.log(`📊 取得した行数: ${rows.length}件`);
      
      let result = '';
      
      // 各行の内容を取得
      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const cells = await row.$$('td');
          
          let rowContent = '';
          for (const cell of cells) {
            const text = await cell.evaluate(el => el.textContent || '');
            rowContent += text.trim() + '\t';
          }
          
          result += rowContent.trim() + '\n';
          console.log(`✅ 行 ${i + 1} の内容を取得しました`);
        } catch (error) {
          console.warn(`⚠️ 行 ${i + 1} の取得に失敗しました:`, error);
        }
      }
      
      console.log('✅ テーブル内容の取得が完了しました');
      return result;
    } catch (error) {
      console.error('❌ テーブル内容の取得中にエラーが発生しました:', error);
      throw error;
    }
  }

  async scrapeCandidateDetails(url: string): Promise<Record<string, string>> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 候補者詳細情報のスクレイピングを開始します...');
    
    try {
      // 指定されたURLにアクセス
      console.log(`📝 アクセス先: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      console.log(`📍 現在のURL: ${this.page.url()}`);
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const details: Record<string, string> = {};
      
      // 名前を取得
      try {
        const nameElement = await this.page.$('.candidate-name, .name, [class*="candidate-name"], [class*="name"]');
        if (nameElement) {
          const name = await nameElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.name = name;
          console.log(`👤 名前: ${details.name}`);
        }
      } catch (error) {
        console.warn('⚠️ 名前の取得に失敗しました:', error);
      }
      
      // 住所を取得
      try {
        const addressElement = await this.page.$('.address, [class*="address"], .location, [class*="location"]');
        if (addressElement) {
          const address = await addressElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.address = address;
          console.log(`📍 住所: ${details.address}`);
        }
      } catch (error) {
        console.warn('⚠️ 住所の取得に失敗しました:', error);
      }
      
      // 電話番号を取得
      try {
        const phoneElement = await this.page.$('.phone, [class*="phone"], .tel, [class*="tel"]');
        if (phoneElement) {
          const phone = await phoneElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.phone = phone;
          console.log(`📞 電話番号: ${details.phone}`);
        }
      } catch (error) {
        console.warn('⚠️ 電話番号の取得に失敗しました:', error);
      }
      
      // メールアドレスを取得
      try {
        const emailElement = await this.page.$('.email, [class*="email"], .mail, [class*="mail"]');
        if (emailElement) {
          const email = await emailElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.email = email;
          console.log(`📧 メールアドレス: ${details.email}`);
        }
      } catch (error) {
        console.warn('⚠️ メールアドレスの取得に失敗しました:', error);
      }
      
      // 生年月日を取得
      try {
        const birthDateElement = await this.page.$('.birth-date, [class*="birth-date"], .birthday, [class*="birthday"]');
        if (birthDateElement) {
          const birthDate = await birthDateElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.birthDate = birthDate;
          console.log(`🎂 生年月日: ${details.birthDate}`);
        }
      } catch (error) {
        console.warn('⚠️ 生年月日の取得に失敗しました:', error);
      }
      
      // 性別を取得
      try {
        const genderElement = await this.page.$('.gender, [class*="gender"], .sex, [class*="sex"]');
        if (genderElement) {
          const gender = await genderElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.gender = gender;
          console.log(`⚧ 性別: ${details.gender}`);
        }
      } catch (error) {
        console.warn('⚠️ 性別の取得に失敗しました:', error);
      }
      
      // 最終学歴を取得
      try {
        const educationElement = await this.page.$('.education, [class*="education"], .academic, [class*="academic"]');
        if (educationElement) {
          const education = await educationElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.education = education;
          console.log(`🎓 最終学歴: ${details.education}`);
        }
      } catch (error) {
        console.warn('⚠️ 最終学歴の取得に失敗しました:', error);
      }
      
      // 職歴を取得
      try {
        const workHistoryElement = await this.page.$('.work-history, [class*="work-history"], .experience, [class*="experience"]');
        if (workHistoryElement) {
          const workHistory = await workHistoryElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.workHistory = workHistory;
          console.log(`💼 職歴: ${details.workHistory}`);
        }
      } catch (error) {
        console.warn('⚠️ 職歴の取得に失敗しました:', error);
      }
      
      // スキルを取得
      try {
        const skillsElement = await this.page.$('.skills, [class*="skills"], .ability, [class*="ability"]');
        if (skillsElement) {
          const skills = await skillsElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.skills = skills;
          console.log(`🛠️ スキル: ${details.skills}`);
        }
      } catch (error) {
        console.warn('⚠️ スキルの取得に失敗しました:', error);
      }
      
      // 自己PRを取得
      try {
        const selfPRElement = await this.page.$('.self-pr, [class*="self-pr"], .pr, [class*="pr"]');
        if (selfPRElement) {
          const selfPR = await selfPRElement.evaluate((el: Element) => el.textContent?.trim() || '');
          details.selfPR = selfPR;
          console.log(`💬 自己PR: ${details.selfPR}`);
        }
      } catch (error) {
        console.warn('⚠️ 自己PRの取得に失敗しました:', error);
      }
      
      // すべての値をトリム
      Object.keys(details).forEach(key => {
        details[key] = details[key].trim();
      });
      
      console.log('✅ 候補者詳細情報の取得が完了しました');
      return details;
    } catch (error) {
      console.error('❌ 候補者詳細情報の取得中にエラーが発生しました:', error);
      throw error;
    }
  }

  async scrapeCandidateFromTable(url: string): Promise<Record<string, string>[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 テーブルから候補者情報のスクレイピングを開始します...');
    
    try {
      // 指定されたURLにアクセス
      console.log(`📝 アクセス先: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      console.log(`📍 現在のURL: ${this.page.url()}`);
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // td[_ngcontent-oes-c147]要素を待機
      console.log('⏳ td[_ngcontent-oes-c147]要素を探しています...');
      await this.page.waitForSelector('td[_ngcontent-oes-c147]', { timeout: 10000 });
      
      // すべての候補者セルを取得
      const candidateCells = await this.page.$$('td[_ngcontent-oes-c147]');
      console.log(`📊 取得した候補者セル数: ${candidateCells.length}件`);
      
      const candidates: Record<string, string>[] = [];
      
      // 各セルの内容を取得
      for (let i = 0; i < candidateCells.length; i++) {
        try {
          const cell = candidateCells[i];
          const candidateInfo: Record<string, string> = {};
          
          // セル内のテキストを取得
          const text = await cell.evaluate(el => el.textContent || '');
          candidateInfo.text = text.trim();
          console.log(`✅ 候補者 ${i + 1} の情報: ${text.trim()}`);
          
          // セル内のリンクを取得
          const links = await cell.$$('a');
          if (links.length > 0) {
            for (let j = 0; j < links.length; j++) {
              const href = await links[j].evaluate((el: HTMLAnchorElement) => el.getAttribute('href'));
              if (href) {
                const linkKey = `link${j + 1}`;
                candidateInfo[linkKey] = href;
                console.log(`🔗 候補者 ${i + 1} のリンク ${j + 1}: ${href}`);
              }
            }
          }
          
          candidates.push(candidateInfo);
        } catch (error) {
          console.warn(`⚠️ 候補者 ${i + 1} の情報取得に失敗しました:`, error);
        }
      }
      
      console.log('✅ 候補者情報の取得が完了しました');
      return candidates;
    } catch (error) {
      console.error('❌ 候補者情報の取得中にエラーが発生しました:', error);
      throw error;
    }
  }

  async scrapeCandidateNames(companyId: string): Promise<string[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 候補者名のスクレイピングを開始します...');
    const candidateNames: string[] = [];
    
    try {
      // 企業の求人一覧ページにアクセス
      const jobsUrl = `https://hrmos.co/agent/corporates/${companyId}/jobs`;
      console.log(`📝 求人一覧ページにアクセス: ${jobsUrl}`);
      await this.page.goto(jobsUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 求人リンクを取得
      console.log('🔍 求人リンクを検索中...');
      const jobLinks = await this.page.$$('a[href*="/jobs/"]');
      console.log(`📊 求人リンク数: ${jobLinks.length}件`);
      
      // 各求人ページを処理
      for (let i = 0; i < jobLinks.length; i++) {
        try {
          const jobLink = jobLinks[i];
          const jobUrl = await jobLink.evaluate((el: HTMLAnchorElement) => el.getAttribute('href'));
          if (!jobUrl) {
            console.warn(`⚠️ 求人 ${i+1}/${jobLinks.length} のURLが取得できませんでした`);
            continue;
          }
          console.log(`\n🔍 求人 ${i+1}/${jobLinks.length} を処理中: ${jobUrl}`);
          
          // 求人ページにアクセス
          await this.page.goto(jobUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // 候補者一覧ページにアクセス
          const candidatesUrl = `${jobUrl}/candidates`;
          console.log(`📝 候補者一覧ページにアクセス: ${candidatesUrl}`);
          await this.page.goto(candidatesUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // td[_ngcontent-oes-c147]要素を待機
          console.log('⏳ td[_ngcontent-oes-c147]要素を探しています...');
          await this.page.waitForSelector('td[_ngcontent-oes-c147]', { timeout: 10000 });
          
          // すべての候補者名セルを取得
          const nameCells = await this.page.$$('td[_ngcontent-oes-c147]');
          console.log(`📊 取得した候補者名セル数: ${nameCells.length}件`);
          
          // 各セルから名前を取得
          for (let j = 0; j < nameCells.length; j++) {
            try {
              const cell = nameCells[j];
              const name = await cell.evaluate((el: HTMLElement) => el.textContent?.trim() || '');
              const trimmedName = name.trim();
              if (trimmedName) {
                candidateNames.push(trimmedName);
                console.log(`✅ 候補者名: ${trimmedName}`);
              }
            } catch (error) {
              console.warn(`⚠️ 候補者 ${j+1} の名前取得に失敗しました:`, error);
            }
          }
        } catch (error) {
          console.warn(`⚠️ 求人 ${i+1}/${jobLinks.length} の処理中にエラーが発生しました:`, error);
          continue;
        }
      }
      
      console.log(`\n📊 合計 ${candidateNames.length} 件の候補者名を取得しました`);
      return candidateNames;
    } catch (error) {
      console.error('❌ 候補者名の取得中にエラーが発生しました:', error);
      throw error;
    }
  }

  async scrapeCandidateTableInfo(companyId: string): Promise<Record<string, string>[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 候補者テーブル情報のスクレイピングを開始します...');
    const candidateInfos: Record<string, string>[] = [];
    
    try {
      // 企業の求人一覧ページにアクセス
      const jobsUrl = `https://hrmos.co/agent/corporates/${companyId}/jobs`;
      console.log(`📝 求人一覧ページにアクセス: ${jobsUrl}`);
      await this.page.goto(jobsUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 求人リンクを取得
      console.log('🔍 求人リンクを検索中...');
      const jobLinks = await this.page.$$('a[href*="/jobs/"]');
      console.log(`📊 求人リンク数: ${jobLinks.length}件`);
      
      // 各求人ページを処理
      for (let i = 0; i < jobLinks.length; i++) {
        try {
          const jobLink = jobLinks[i];
          const jobUrl = await jobLink.evaluate((el: HTMLAnchorElement) => el.getAttribute('href'));
          if (!jobUrl) {
            console.warn(`⚠️ 求人 ${i+1}/${jobLinks.length} のURLが取得できませんでした`);
            continue;
          }
          console.log(`\n🔍 求人 ${i+1}/${jobLinks.length} を処理中: ${jobUrl}`);
          
          // 求人ページにアクセス
          await this.page.goto(jobUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // 候補者一覧ページにアクセス
          const candidatesUrl = `${jobUrl}/candidates`;
          console.log(`📝 候補者一覧ページにアクセス: ${candidatesUrl}`);
          await this.page.goto(candidatesUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // hrm-nav-listを待機
          console.log('⏳ hrm-nav-listを探しています...');
          await this.page.waitForSelector('hrm-nav-list', { timeout: 10000 });
          
          // hrm-nav-list内のa[_ngcontent-oes-c144]要素を待機
          console.log('⏳ a[_ngcontent-oes-c144]要素を探しています...');
          await this.page.waitForSelector('hrm-nav-list a[_ngcontent-oes-c144]', { timeout: 10000 });
          
          // hrm-nav-list内のa[_ngcontent-oes-c144]要素を取得
          const candidateLinks = await this.page.$$('hrm-nav-list a[_ngcontent-oes-c144]');
          console.log(`📊 候補者リンク数: ${candidateLinks.length}件`);
          
          // 各候補者ページを処理
          for (let j = 0; j < candidateLinks.length; j++) {
            try {
              const candidateLink = candidateLinks[j];
              const candidateUrl = await candidateLink.evaluate((el: HTMLAnchorElement) => el.getAttribute('href'));
              if (!candidateUrl) {
                console.warn(`⚠️ 候補者 ${j+1}/${candidateLinks.length} のURLが取得できませんでした`);
                continue;
              }
              console.log(`\n🔍 候補者 ${j+1}/${candidateLinks.length} を処理中: ${candidateUrl}`);
              
              // 候補者ページにアクセス
              await this.page.goto(candidateUrl, { waitUntil: 'networkidle0', timeout: 30000 });
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // table[_ngcontent-dsh-c147]要素を待機
              console.log('⏳ table[_ngcontent-dsh-c147]要素を探しています...');
              await this.page.waitForSelector('table[_ngcontent-dsh-c147]', { timeout: 10000 });
              
              // テーブル内のすべての行を取得
              const rows = await this.page.$$('table[_ngcontent-dsh-c147] tr');
              console.log(`📊 取得した行数: ${rows.length}件`);
              
              const candidateInfo: Record<string, string> = {
                url: candidateUrl || ''
              };
              
              // 各行の内容を取得
              for (let k = 0; k < rows.length; k++) {
                try {
                  const row = rows[k];
                  const cells = await row.$$('td');
                  
                  if (cells.length >= 2) {
                    // 最初のセルをラベルとして使用
                    const label = await cells[0].evaluate((el: Element) => el.textContent || '');
                    const value = await cells[1].evaluate((el: Element) => el.textContent || '');
                    
                    if (label.trim() && value.trim()) {
                      candidateInfo[label.trim()] = value.trim();
                      console.log(`✅ ${label.trim()}: ${value.trim()}`);
                    }
                  }
                } catch (error) {
                  console.warn(`⚠️ 行 ${k+1} の取得に失敗しました:`, error);
                }
              }
              
              candidateInfos.push(candidateInfo);
              console.log('✅ 候補者情報の取得が完了しました');
            } catch (error) {
              console.warn(`⚠️ 候補者 ${j+1}/${candidateLinks.length} の処理中にエラーが発生しました:`, error);
              continue;
            }
          }
        } catch (error) {
          console.warn(`⚠️ 求人 ${i+1}/${jobLinks.length} の処理中にエラーが発生しました:`, error);
          continue;
        }
      }
      
      console.log(`\n📊 合計 ${candidateInfos.length} 件の候補者情報を取得しました`);
      return candidateInfos;
    } catch (error) {
      console.error('❌ 候補者情報の取得中にエラーが発生しました:', error);
      throw error;
    }
  }

  async scrapeCandidateLinks(companyId: string): Promise<string[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 候補者リンクのスクレイピングを開始します...');
    const candidateLinks: string[] = [];
    
    try {
      // 企業の求人一覧ページにアクセス
      const jobsUrl = `https://hrmos.co/agent/corporates/${companyId}/jobs`;
      console.log(`📝 求人一覧ページにアクセス: ${jobsUrl}`);
      await this.page.goto(jobsUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // ページの読み込みが完了するまで待機
      console.log('⏳ ページの読み込みを待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 求人リンクを取得
      console.log('🔍 求人リンクを検索中...');
      const jobLinks = await this.page.$$('a[href*="/jobs/"]');
      console.log(`📊 求人リンク数: ${jobLinks.length}件`);
      
      // 各求人ページを処理
      for (let i = 0; i < jobLinks.length; i++) {
        try {
          const jobLink = jobLinks[i];
          const jobUrl = await jobLink.evaluate((el: HTMLAnchorElement) => el.getAttribute('href'));
          if (!jobUrl) {
            console.warn(`⚠️ 求人 ${i+1}/${jobLinks.length} のURLが取得できませんでした`);
            continue;
          }
          console.log(`\n🔍 求人 ${i+1}/${jobLinks.length} を処理中: ${jobUrl}`);
          
          // 求人ページにアクセス
          await this.page.goto(jobUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // 候補者一覧ページにアクセス
          const candidatesUrl = `${jobUrl}/candidates`;
          console.log(`📝 候補者一覧ページにアクセス: ${candidatesUrl}`);
          await this.page.goto(candidatesUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // hrm-nav-list-user-itemタグを待機
          console.log('⏳ hrm-nav-list-user-itemタグを探しています...');
          await this.page.waitForSelector('hrm-nav-list-user-item', { timeout: 10000 });
          
          // hrm-nav-list-user-item内のa[_ngcontent-dsh-c144]要素を取得
          const candidateElements = await this.page.$$('hrm-nav-list-user-item a[_ngcontent-dsh-c144]');
          console.log(`📊 候補者要素数: ${candidateElements.length}件`);
          
          // 各候補者要素からリンクを取得
          for (let j = 0; j < candidateElements.length; j++) {
            try {
              const candidateElement = candidateElements[j];
              const href = await candidateElement.evaluate((el: HTMLAnchorElement) => el.getAttribute('href'));
              if (!href) {
                console.warn(`⚠️ 候補者要素 ${j+1} のリンク取得に失敗しました`);
                continue;
              }
              console.log(`✅ 候補者リンク ${j+1}: ${href}`);
              candidateLinks.push(href);
            } catch (error) {
              console.warn(`⚠️ 候補者要素 ${j+1} のリンク取得に失敗しました:`, error);
            }
          }
        } catch (error) {
          console.warn(`⚠️ 求人 ${i+1}/${jobLinks.length} の処理中にエラーが発生しました:`, error);
          continue;
        }
      }
      
      console.log(`\n📊 合計 ${candidateLinks.length} 件の候補者リンクを取得しました`);
      return candidateLinks;
    } catch (error) {
      console.error('❌ 候補者リンクの取得中にエラーが発生しました:', error);
      throw error;
    }
  }
} 