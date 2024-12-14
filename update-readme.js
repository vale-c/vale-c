const fs = require('fs').promises;
const Parser = require('rss-parser');
const path = require('path');

const parser = new Parser({
  timeout: 60000, // 60 seconds timeout
});
const readmeFile = path.join(__dirname, 'README.md');
const rssUrl = 'https://valentinacalabrese.com/api/rss';

async function fetchBlogPosts() {
  try {
    const feed = await parser.parseURL(rssUrl);
    feed.items.forEach(item => {
      console.log(`Title: ${item.title}`);
      console.log(`Categories: ${item.categories}`);
    });
    return feed.items;
  } catch (error) {
    console.error('Error fetching or parsing RSS feed:', error);
    return null;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function generateBlogPostsSection(posts) {
  if (!posts || posts.length === 0) {
    return '## 📘 Latest Blog Posts\n\nUnable to fetch blog posts at this time. Please check back later!\n';
  }

  let blogPostsSection = '## 📘 Latest Blog Posts\n\n';

  posts.slice(0, 5).forEach(post => {
    const date = formatDate(post.pubDate || post.isoDate);
    const categories = post.categories ? post.categories.join(', ') : 'Uncategorized';
    blogPostsSection += `* [${post.title}](${post.link})\n  <br/><sub>${date} | ${categories}</sub>\n\n`;
  });

  if (posts.length > 5) {
    blogPostsSection += '<details>\n  <summary>Read more blog posts</summary>\n\n';
    posts.slice(5).forEach(post => {
      const date = formatDate(post.pubDate || post.isoDate);
      const categories = post.categories ? post.categories.join(', ') : 'Uncategorized';
      blogPostsSection += `* [${post.title}](${post.link})\n  <br/><sub>${date} | ${categories}</sub>\n\n`;
    });
    blogPostsSection += '</details>\n';
  }

  return blogPostsSection;
}

async function updateReadme() {
  try {
    const posts = await fetchBlogPosts();
    const blogPostsSection = generateBlogPostsSection(posts);

    let readme = await fs.readFile(readmeFile, 'utf8');
    
    const blogPostsSectionRegex = /## 📘 Latest Blog Posts[\s\S]*?(?=##|$)/;
    
    if (blogPostsSectionRegex.test(readme)) {
      readme = readme.replace(blogPostsSectionRegex, blogPostsSection);
    } else {
      readme += '\n\n' + blogPostsSection;
    }

    await fs.writeFile(readmeFile, readme);
    console.log('README.md has been updated successfully.');
  } catch (error) {
    console.error('Error updating README.md:', error);
  }
}

updateReadme();
