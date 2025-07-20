import express from 'express';
import fetch from 'node-fetch';
import { load } from 'cheerio';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 5000;

async function fetchISBNData(isbn) {
  // 先嘗試 Google Books API
  try {
    // const googleResponse = await fetch(
    //   `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    // );
    // const data = await googleResponse.json();
    // console.log('googleResponse', data);
    // if (data.totalItems > 0) {
    //   const bookInfo = data.items[0].volumeInfo;
    //   const book = {
    //     title: bookInfo.title,
    //     author: bookInfo.authors?.join(', ') || '',
    //     isbn: isbn,
    //   };
    //   console.log('book from google', book);
    //   return [book];
    // }

    // Google Books 找不到，改用博客來
    try {
      const response = await fetch(
        `https://search.books.com.tw/search/query/key/${isbn}/cat/all`
      );
      const html = await response.text();
      const $ = load(html);

      const firstBook = $('.table-container .table-tr .table-td').first();
      if (firstBook.length === 0) {
        console.log('No book found on books.com.tw');
        return [];
      }

      const title =
        firstBook
          .find('h4 a')
          .first()
          .attr('title')
          ?.replace(' (電子書)', '') || '';
      const author = firstBook
        .find('.type .author a')
        .map((_, el) => $(el).attr('title'))
        .get()
        .join(', ');

      if (!title && !author) {
        console.log('No valid book info found on books.com.tw');
        return [];
      }

      const book = { isbn, title, author };
      return [book];
    } catch (blogError) {
      console.error('Error fetching from books.com.tw:', blogError);
      return [];
    }
  } catch (error) {
    console.error('Error fetching book data:', error);
    return [];
  }
}

async function fetchNCLData(isbn) {
  try {
    console.log(`\n=== 開始搜尋 ISBN: ${isbn} ===`);

    // 第一步：獲取搜尋頁面以取得動態的 INFO 值和 action URL
    console.log('步驟1: 獲取搜尋頁面來取得動態參數...');
    const homepageResponse = await fetch(
      'https://metadata.ncl.edu.tw/blstkmc/blstkm',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        },
      }
    );

    if (!homepageResponse.ok) {
      console.error('無法獲取搜尋頁面:', homepageResponse.status);
      return [];
    }

    const homepageHtml = await homepageResponse.text();
    const $ = load(homepageHtml);

    // 提取動態的 INFO 值
    const infoValue = $('input[name="INFO"]').attr('value');
    if (!infoValue) {
      console.error('無法找到 INFO 欄位');
      return [];
    }

    // 提取動態的 form action
    const formAction = $('form[name="KM"]').attr('action');
    if (!formAction) {
      console.error('無法找到 form action');
      return [];
    }

    // 構建完整的 action URL
    const actionUrl = formAction.startsWith('http')
      ? formAction
      : `https://metadata.ncl.edu.tw${formAction}`;

    console.log(`動態 INFO 值: ${infoValue}`);
    console.log(`動態 Action URL: ${actionUrl}`);

    // 第二步：使用動態值進行搜尋
    console.log('步驟2: 使用動態參數提交搜尋請求...');
    const formData = new URLSearchParams();
    formData.append('@_1_13_n', 'n_');
    formData.append('@_1_13_n_1', 'n_1');
    formData.append('@_1_13_n_2', 'n_2');
    formData.append('_1_13_n_1', 'n_SB/BB');
    formData.append('_1_13_n_2', isbn);
    formData.append('@_1_20_K', 'K_search_method');
    formData.append('_1_20_K', 'C');
    formData.append('@_1_10_T', 'T_YR');
    formData.append('_1_10_T', '');
    formData.append('@_1_11_T', 'T_YR');
    formData.append('_1_11_T', '');
    formData.append('INFO', infoValue); // 使用動態 INFO 值
    formData.append('_IMG_檢索.x', '10');
    formData.append('_IMG_檢索.y', '10');

    const response = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Referer: 'https://metadata.ncl.edu.tw/blstkmc/blstkm',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      body: formData.toString(),
    });

    const html = await response.text();
    console.log(`回應狀態: ${response.status}`);
    console.log(`HTML 長度: ${html.length}`);

    if (!response.ok) {
      console.log('錯誤回應 HTML:', html.substring(0, 500));
      return [];
    }

    const $result = load(html);

    // 尋找結果表格中的第一個有效行
    const firstRow = $result('.sumtab .sumtr1').first();

    if (firstRow.length === 0) {
      console.log('NCL 資料庫中找不到書籍');
      return [];
    }

    console.log(`找到 ${$result('.sumtr1').length} 個結果`);

    const titleElement = firstRow.find('.sumtd2000 a');
    const authorElement = firstRow.find('.sumtd2001');

    const title =
      titleElement.attr('title') || titleElement.text().trim() || '';
    const author = authorElement.text().replace('#', '').trim() || '';

    if (!title && !author) {
      console.log('找不到有效的書籍資訊');
      return [];
    }

    const book = { isbn, title, author };
    console.log('書籍資料:', book);
    return [book];
  } catch (error) {
    console.error('從 NCL 獲取資料時發生錯誤:', error);
    return [];
  }
}

// 加入基本的健康檢查路由
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// API 路由
app.get('/search', async (req, res) => {
  try {
    let isbn = req.query.isbn;
    let data = await fetchISBNData(isbn);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新的 NCL 搜尋接口（含備援邏輯）
app.get('/search-new', async (req, res) => {
  try {
    let isbn = req.query.isbn;
    if (!isbn) {
      return res.status(400).json({ error: 'ISBN parameter is required' });
    }

    console.log(`\n=== 新 API 開始處理 ISBN: ${isbn} ===`);

    // 首先嘗試 NCL 搜尋
    console.log('🔍 優先使用 NCL 搜尋...');
    let data = await fetchNCLData(isbn);

    // 如果 NCL 沒有找到結果，使用舊的方法作為備援
    if (!data || data.length === 0) {
      console.log('⚠️  NCL 沒有找到結果，切換到備援搜尋方法...');
      data = await fetchISBNData(isbn);

      if (data && data.length > 0) {
        console.log('✅ 備援方法找到結果:', data[0]);
        // 為備援結果添加來源標記
        data[0].source = 'fallback';
      } else {
        console.log('❌ 所有搜尋方法都無法找到結果');
      }
    } else {
      console.log('✅ NCL 找到結果:', data[0]);
      // 為 NCL 結果添加來源標記
      data[0].source = 'ncl';
    }

    res.json(data);
  } catch (error) {
    console.error('🚨 新 API 發生錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 啟動後端伺服器
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
