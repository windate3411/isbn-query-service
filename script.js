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
    const googleResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    );
    const data = await googleResponse.json();
    console.log('googleResponse', data);
    if (data.totalItems > 0) {
      const bookInfo = data.items[0].volumeInfo;
      const book = {
        title: bookInfo.title,
        author: bookInfo.authors?.join(', ') || '',
        isbn: isbn,
      };
      console.log('book from google', book);
      return [book];
    }

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
      console.log('book from blog', book);
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

// 啟動後端伺服器
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
