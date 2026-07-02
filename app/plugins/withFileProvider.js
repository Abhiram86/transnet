const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

module.exports = function withFileProvider(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.application || manifest.application.length === 0) {
      return config;
    }

    const application = manifest.application[0];

    if (!application.provider) {
      application.provider = [];
    }

    const hasProvider = application.provider.some(
      (p) => p.$["android:name"] === "androidx.core.content.FileProvider"
    );

    if (hasProvider) {
      return config;
    }

    application.provider.push({
      $: {
        "android:name": "androidx.core.content.FileProvider",
        "android:authorities": "${applicationId}.fileprovider",
        "android:exported": "false",
        "android:grantUriPermissions": "true",
      },
      "meta-data": [
        {
          $: {
            "android:name": "android.support.FILE_PROVIDER_PATHS",
            "android:resource": "@xml/file_paths",
          },
        },
      ],
    });

    return config;
  });

  config = withDangerousMod(config, [
    "android",
    (config) => {
      const resXmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );

      if (!fs.existsSync(resXmlDir)) {
        fs.mkdirSync(resXmlDir, { recursive: true });
      }

      const filePath = path.join(resXmlDir, "file_paths.xml");
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(
          filePath,
          `<?xml version="1.0" encoding="utf-8"?>
<paths>
    <external-path name="transnet_downloads" path="Download/TransNet/" />
</paths>
`
        );
      }

      return config;
    },
  ]);

  return config;
};
