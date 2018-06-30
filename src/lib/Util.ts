import { glob } from 'glob';
import mv = require('mv');

export const move_file = (file_pattern: string, new_filename: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
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
