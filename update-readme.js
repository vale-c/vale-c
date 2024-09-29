const fs = require('fs');
const Parser = require('rss-parser');

const parser = new Parser();
const readmeFile = './README.md';

const updateReadme = async () => {
  const feed = await parser.parseURL('https://valentinacalabrese.com/api/rss');
  
  let blogPostsSection = '## Latest Blog Posts\n\n';
  
  feed.items.slice(0, 5).forEach(item => {
    blogPostsSection += `- [${item.title}](${item.link})\n`;
  });
  
  blogPostsSection += '\n[Read more blog posts →](https://valentinacalabrese.com/blog)\n';

  let readme = fs.readFileSync(readmeFile, 'utf8');
  
  // Check if the blog posts section already exists
  const blogPostsSectionRegex = /## Latest Blog Posts[\s\S]*?\[Read more blog posts →\]\(https:\/\/valentinacalabrese\.com\/blog\)/;
  
  if (blogPostsSectionRegex.test(readme)) {
    // Replace existing section
    readme = readme.replace(blogPostsSectionRegex, blogPostsSection);
  } else {
    // Append new section
    readme += '\n\n' + blogPostsSection;
  }

  fs.writeFileSync(readmeFile, readme);
};

updateReadme();
