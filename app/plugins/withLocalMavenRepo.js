const { withProjectBuildGradle } = require("@expo/config-plugins");

const REPO_URL =
  "${rootProject.projectDir}/../modules/transnet/android/libs/repo";

module.exports = function withLocalMavenRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes(REPO_URL)) {
      return config;
    }

    const marker = "maven { url 'https://www.jitpack.io' }";
    if (!contents.includes(marker)) {
      return config;
    }

    config.modResults.contents = contents.replace(
      marker,
      `${marker}\n    maven { url "${REPO_URL}" }`
    );

    return config;
  });
};
