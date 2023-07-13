<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a>
    <img src="https://github.com/farukkavlak/Vocab-Learning-Chrome-Extension/blob/main/extension/logo.png" alt="Logo" width="180" height="180">
  </a>

<h3 align="center">VocabBoost</h3>

  <p align="center">
    Vocabulary learning extension powered by AI/ChatGPT
    <br>
    <a href="#usage">Screenshots</a>
    ·
    <a href="https://github.com/farukkavlak/Vocab-Learning-Chrome-Extension/issues">Report Bug</a>
    ·
    <a href="https://github.com/farukkavlak/Vocab-Learning-Chrome-Extension/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
        <li><a href="#external-services">External Services</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project
Vocabulary learning extension powered by AI.It is designed to be used to learn when there is a word that you do not understand in the subtitle while watching a movie.
It is a chrome extension that allows you to ask artificial intelligence for an explanation and example sentence with the help of a shortcut in real time when you encounter an English word that you do not know while watching a movie,series etc.
<p align="right">(<a href="#readme-top">back to top</a>)</p>



### Built With

* [![javascript][javascript]][javascript]
* [![node-js][node-js]][node-js]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### External Services

* ChatGPT
* Google Vision API - Optical Character Recognition (OCR)

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- GETTING STARTED -->
## Getting Started

This is an example of how you may give instructions on setting up your project locally.
To get a local copy up and running follow these simple example steps.

### Installation

1. Get a API Key at [https://platform.openai.com/](https://platform.openai.com/)
2. Get a API Key at [https://cloud.google.com/vision](https://cloud.google.com/vision/docs/before-you-begin)
3. Clone the repo
   ```sh
   git clone https://github.com/farukkavlak/Vocab-Learning-Chrome-Extension.git
   ```
4. There are two folder in project such as Extension and Server
5. Install NPM packages in the server
   ```sh
   npm install
   ```
6. Create .env file in Server for environment variables and enter your OpenAI API key
     ```js
   STATUS = dev
   DEV_PORT = 3000
   PROD_PORT = 80
   OPENAI_API_KEY = 'ENTER YOUR API KEY'
   
   ```
7. Enter your Google Vision API key and your server url(http://localhost/3000) in the extension/content.js
8. Run server
    ```sh
   nodemon index.js
   ```
9. Load chrome extension from chrome://extensions/


<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage
To use the extension, just press the extension's shortcut while watching a movie, series or any video with subtitles. This shortcut is **ctrl+h** for windows and **cmd+h** for macos. The video on the screen is paused so you don't miss the movie. Then, thanks to the Google Vision OCR API, the application captures the text in the photo and turns them into clickable buttons.(If you do not want to continue the process, you can press the **ESC** key, the buttons will disappear from the screen and the video will continue.) When you click on the word you want to learn the meaning of, it takes the meaning of this word and an example sentence with the help of ChatGPT and shows it as an alert. When you close the alert, the video continues.

Screenshots are black because of the Netflix Privacy Issues
<div align="center">
  <a>
    <img src="https://github.com/farukkavlak/Vocab-Learning-Chrome-Extension/blob/main/screenshots/usage-1.png" alt="usage-1">
  </a>
</div>
<br>
<div align="center">
  <a>
    <img src="https://github.com/farukkavlak/Vocab-Learning-Chrome-Extension/blob/main/screenshots/usage-2.png" alt="usage-2">
  </a>
</div>
<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTACT -->
## Contact

Ömer Faruk Kavlak -  [linkedin.com/in/ömerfarukkavlak](https://www.linkedin.com/in/ömerfarukkavlak/)- [@ofarukdev](https://twitter.com/ofarukdev) - ofaruk.kavlak@gmail.com


<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[javascript]: https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black
[node-js]: https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white
