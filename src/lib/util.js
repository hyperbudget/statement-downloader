const glob = require('glob');
const mv = require('mv');

const move_file = (file_pattern, new_filename) => {
  return new Promise((resolve, reject) => {
    let found = false;

    glob(file_pattern, { }, function(er, files) {
      if (er) {
        reject(er);
      }
      let file = files[0];
      if (!file) {
        return reject("Could not find a file matching " + file_pattern);
      }
      mv( file, new_filename, (err) => err ? reject(err) : resolve(new_filename)  );
    });
  });
}

module.exports = { move_file: move_file };
