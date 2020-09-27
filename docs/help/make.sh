#!/bin/sh

pandoc --template template.html index.md -o ../../public/help/index.html
pandoc --template template.html confirmation.md -o ../../public/help/confirmation.html
pandoc --template template.html registration.md -o ../../public/help/registration.html
pandoc --template template.html submission.md -o ../../public/help/submission.html
rm -fr ../../public/help/images
cp -r ./images ../../public/help/

