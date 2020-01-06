const fs = require("fs");
const readline = require("readline");
const yaml = require("js-yaml");
const crypto = require("crypto");

const sources = "sources";
const dist = "authorea";

const getPublicationHtml = publication =>
  new Promise((resolve, reject) => {
    let html = "";

    try {
      const layoutInput = fs.createReadStream(
        `${sources}/${publication}/layout.md`
      );
      const layoutInterface = readline.createInterface({
        input: layoutInput
      });

      layoutInterface.on("line", line => {
        try {
          const file = `${sources}/${publication}/${line}`;
          if (fs.lstatSync(file).isFile()) {
            const section = fs.readFileSync(file, "utf8");
            html += `<div>${section}</div>`;
          } else {
            html = handleLayoutFolder(html, publication, line);
          }
        } catch (err) {
          console.error(`Missing file ${line} from ${publication}/layout.md\n`);
          resolve({ publication });
        }
      });

      layoutInterface.on("close", () => {
        // finished layout.md -> Include title file
        const titlePath = `${sources}/${publication}/title.html`;
        if (fs.existsSync(titlePath)) {
          const title = fs.readFileSync(
            `${sources}/${publication}/title.html`,
            "utf8"
          );
          html = `<h1>${title}</h1>${html}`;
        }
        resolve({ publication, html });
      });
    } catch (err) {
      resolve({ publication });
    }
  });

const handleLayoutFolder = (html, publication, line) => {
  const files = fs.readdirSync(`${sources}/${publication}/${line}`);
  const config = yaml.safeLoad(
    fs.readFileSync(`${sources}/${publication}/${line}/config.yml`, "utf8")
  );

  const images = config.grid.grid_elements.map(({ path }) => {
    const type = path.split(".")[1];
    const imageFile = fs.readFileSync(
      `${sources}/${publication}/${path}`,
      "base64"
    );
    return `<img width="${config["web-width"]}" src="data:image/${type};base64,${imageFile}"/>`;
  });

  console.log(`Converted assets in ${publication}: ${line}`);
  return (
    html + `<div style="text-align: ${config.align}">${images.join("")}</div>`
  );
};

const cleanupHtml = html =>
  html.replace(/\\\(\\\)/g, "").replace(/(\\)?cite{([a-zA-Z0-9]+)}/g, "$2");

const escapeHtml = html =>
  html
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const hashString = string =>
  crypto
    .createHash("md5")
    .update(string)
    .digest("hex");

const start = async () => {
  fs.rmdirSync(dist, { recursive: true });
  fs.mkdirSync(dist);

  const output = await Promise.all(
    fs.readdirSync(sources).map(getPublicationHtml)
  );

  output
    .filter(x => x)
    .forEach(({ publication, html }) => {
      const parsedHtml = cleanupHtml(html);
      const escapedHtml = escapeHtml(parsedHtml);
      const hashedName = hashString(publication);
      fs.writeFileSync(`${dist}/${hashedName}.html`, parsedHtml);
      fs.writeFileSync(`${dist}/${hashedName}_source.html`, escapedHtml);
    });

  fs.writeFileSync(
    `${dist}/index.html`,
    `
      <link rel="stylesheet" type="text/css" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css"></style>
      <div class="container-fluid" style="margin-top: 20px">
        <h3>PREreview - Authorea handover</h3>
        <ul>
          ${output
            .map(({ publication }) => {
              const hashedName = hashString(publication);
              return `<li>${publication} [<a href="${hashedName}.html">View Publication</a>, <a href="${hashedName}_source.html">View Source</a>]</li>`;
            })
            .join("")}
        </ul>
      </div>
    `
  );
};

start();
