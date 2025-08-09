'use client'

import { useState, useEffect } from 'react';
import ListItem from '../ListItem';

export default function CategoryPage({ params }) {
  const [posts, setPosts] = useState([]);
  const { category } = params;

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch(`/api/categories/${category}`);
        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }
        const data = await response.json();
        setPosts(data);
      } catch (error) {
        console.error('Error fetching posts:', error);
      }
    };

    if (category) {
      fetchPosts();
    }
  }, [category]);

  return (
    <div className="list-bg">
      <h2>{decodeURIComponent(category)} Posts</h2>
      <ListItem result={posts} />
    </div>
  );
}
