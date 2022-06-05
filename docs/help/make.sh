#!/bin/sh

pandoc --template template.html --metadata pagetitle="Help Top" index.md -o ../../public/help/index.html
pandoc --template template.html --metadata pagetitle="Registration" registration.md -o ../../public/help/registration.html
pandoc --template template.html --metadata pagetitle="Submission" submission.md -o ../../public/help/submission.html
pandoc --template template.html --metadata pagetitle="Confirmation" confirmation.md -o ../../public/help/confirmation.html
rm -fr ../../public/help/images
cp -r ./images ../../public/help/

