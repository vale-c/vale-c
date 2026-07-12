const fs = require('fs').promises;
const Parser = require('rss-parser');
const path = require('path');

const parser = new Parser({
  timeout: 60000, // 60 seconds timeout
});
const readmeFile = path.join(__dirname, 'README.md');
const rssUrl = 'https://valentinacalabrese.com/api/rss';

const START_MARKER = '<!-- BLOG-POSTS:START -->';
const END_MARKER = '<!-- BLOG-POSTS:END -->';

async function fetchBlogPosts() {
  try {
    const feed = await parser.parseURL(rssUrl);
    feed.items.forEach(item => {
      console.log(`Title: ${item.title}`);
    });
    return feed.items;
  } catch (error) {
    console.error('Error fetching or parsing RSS feed:', error);
    return null;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function generateBlogPostsSection(posts) {
  return posts
    .slice(0, 5)
    .map(post => {
      const date = formatDate(post.pubDate || post.isoDate);
      return `- [${post.title}](${post.link}) <sub>${date}</sub>`;
    })
    .join('\n');
}

async function updateReadme() {
  const posts = await fetchBlogPosts();
  if (!posts || posts.length === 0) {
    // Leave the README untouched rather than writing an error into it.
    console.log('No posts fetched; README left unchanged.');
    return;
  }

  const readme = await fs.readFile(readmeFile, 'utf8');
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    console.error('Blog post markers not found in README.md; nothing updated.');
    process.exitCode = 1;
    return;
  }

  const updated =
    readme.slice(0, start + START_MARKER.length) +
    '\n' +
    generateBlogPostsSection(posts) +
    '\n' +
    readme.slice(end);

  if (updated === readme) {
    console.log('Blog posts already up to date.');
    return;
  }

  await fs.writeFile(readmeFile, updated);
  console.log('README.md has been updated successfully.');
}

updateReadme()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error('Error updating README.md:', error);
    process.exit(1);
  });
