# How to Contribute

We would love to accept your patches and contributions to this project.

## Before you begin

### Sign our Contributor License Agreement

Contributions to this project must be accompanied by a
[Contributor License Agreement](https://cla.developers.google.com/about) (CLA).
You (or your employer) retain the copyright to your contribution; this simply
gives us permission to use and redistribute your contributions as part of the
project.

If you or your current employer have already signed the Google CLA (even if it
was for a different project), you probably don't need to do it again.

Visit <https://cla.developers.google.com/> to see your current agreements or to
sign a new one.

### Review our Community Guidelines

This project follows [Google's Open Source Community
Guidelines](https://opensource.google/conduct/).

## Contribution process

### Code Reviews

All submissions, including submissions by project members, require review. We
use [GitHub pull requests](https://docs.github.com/articles/about-pull-requests)
for this purpose.

### Testing

If you make a code change, be sure to run tests, linters, etc.:

- `npm run prepush` will run all tests, code coverage and linters
- `npm run test:headless` will run all tests in headless mode once
- `npm run lint` will run just the linters

Check the scripts on package.json for additional helpers.

If you make a functional change (such as adding a new feature), please add tests
for it - at the very least, testing the UI from the user's perspective and verifying
the functionality.

We've also put a lot of work into setting up linters such that we can keep the same
standards for anyone contributing - so don't be surprised if eslint floods you with
errors at first.
