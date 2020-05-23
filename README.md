# research-groound

research ground.

### setup

    npm install
    cp config.example.json config.json
    vi config.json

### run

    node app.js

----------------------------------------

MongoDB

Not well considered yet. But for the moment...

* DB name: research_ground
    + Collection name: actions
        - { type: 'action_type', utime: number_of_unixtime, and more }
    + Collection name: files
        - { path: 'path to the file', isDir: false }
