# WME SDK Typescript example

This project will help you to bootstrap a typescript version of your next WME Script using the WME-SDK.

## Required only once
- Allow local file access for the Tampermonkey extension, as explained [here](https://www.tampermonkey.net/faq.php?locale=en#Q204).
- Install [npm](https://docs.npmjs.com/cli)
- Install [rollup](https://rollupjs.org) globally: `npm install --global rollup` - This tool will bundle all your files in a single js file that can be used in tampermonkey.
- (Opt. but recommended) install git if you want to have file versioning


## Getting started
- Download this repository (as a zip archive) and extract it in a folder of your choice
- If you have git, now is a good time to initialize your repository by running `git init`
- Update the details in `header.js` and `header-dev.js` (author, script name...)
- Create a new script in Tampermonkey, and paste the content of the `header-dev.js` as explained in that file
- Initialize npm by running `npm install`, this will download and install all packages listed in `package.json`. You can update them by running `npm update`, if needed
- - Update your script ID and Script name inside `main.user.ts`

## Coding
- Using an IDE (e.g. [Visual Studio Code](https://code.visualstudio.com/) ), it should be possible to inspect the data type of your variables and get warning or error when using incompatible types or not checking for unwanted states (e.g. using directly the return value of a function that may return *null*)
- The `.ts` file containing your script (`main.user.ts`) needs to be translated to javascript in order to be used by Tampermonkey.
- Warning: the content of the `.out` folder is generated, you should **never** edit anything in here.
- Use `npm run watch` while developing to convert ts to js and `npm run release` when you want to publish a release.

## Prepare for a release
- Only change the version number inside `package.json`
- Run `npm run release`, if everything goes well, you will get a file with the version in its name inside the `releases` folder.


### Advanced explanation
- FYI, inside `package.json` you can see all the available scripts you can run while developing.
  - compile: compiles your script to javascript **once**, it is unlikely that you need to call this directly.
  - **watch**: use it when you start developing, it will automatically run again every time you change something in your code.
  - concat: concatenates your `header.js` and your `.out/main.user.js` file and places to the `releases` folder
  - build: compile + concat 
  - **release**: replaces the version number inside the header.js file with the one present in the package.json file and runs build

### Switching between production and beta types
- Remove the types that are currently installed by running: `npm uninstall wme-sdk-typings`
- Install the types you want as stated in the [documentation](https://web-assets.waze.com/wme_sdk_docs/production/latest/index.html#md:typescript-type-definitions). 
  - **Production**: `npm install --save-dev https://web-assets.waze.com/wme_sdk_docs/production/latest/wme-sdk-typings.tgz`
  - **Beta**: `npm install --save-dev https://web-assets.waze.com/wme_sdk_docs/beta/latest/wme-sdk-typings.tgz`
