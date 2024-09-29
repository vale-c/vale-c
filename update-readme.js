const fs = require('fs');
const Parser = require('rss-parser');

const parser = new Parser();
const readmeFile = './README.md';

const updateReadme = async () => {
  const feed = await parser.parseURL('https://valentinacalabrese.com/api/rss');
  
  let blogPostsSection = '## 📘 Latest Blog Posts\n\n';
  
  feed.items.slice(0, 5).forEach(item => {
    const date = new Date(item.pubDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    blogPostsSection += `* [${item.title}](${item.link})\n  <br/><sub>${date} | ${item.categories.join(', ')}</sub>\n\n`;
  });
  
  blogPostsSection += '<details>\n  <summary>Read more blog posts</summary>\n\n';
  feed.items.slice(5).forEach(item => {
    const date = new Date(item.pubDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    blogPostsSection += `* [${item.title}](${item.link})\n  <br/><sub>${date} | ${item.categories.join(', ')}</sub>\n\n`;
  });
  blogPostsSection += '</details>\n\n';

  let readme = fs.readFileSync(readmeFile, 'utf8');
  
  const blogPostsSectionRegex = /## 📘 Latest Blog Posts[\s\S]*?<\/details>/;
  
  if (blogPostsSectionRegex.test(readme)) {
    readme = readme.replace(blogPostsSectionRegex, blogPostsSection);
  } else {
    readme += '\n\n' + blogPostsSection;
  }

  fs.writeFileSync(readmeFile, readme);
};

updateReadme();
