import React, { useEffect, useState } from "react";
import axios from "axios";

function NewsFeed({ symbol }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;

    setLoading(true);
    axios
      .get(`/api/news/${symbol}`)
      .then((res) => {
        setNews(res.data || []);
      })
      .catch((err) => {
        console.error("❌ Error fetching news:", err.message);
        setNews([]);
      })
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return <p className="text-gray-400 text-center animate-pulse">Loading news...</p>;
  }

  if (!news.length) {
    return <p className="text-center text-gray-500">No news found for <b>{symbol.toUpperCase()}</b>.</p>;
  }

  return (
    <ul className="space-y-4">
      {news.map((item, index) => (
        <li key={index} className="border-b pb-3">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {item.headline}
          </a>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(item.datetime).toLocaleString()} | {item.source}
          </p>
          <p className="text-gray-700 dark:text-gray-300">{item.summary}</p>
        </li>
      ))}
    </ul>
  );
}

export default NewsFeed;
