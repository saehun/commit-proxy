#!/bin/bash

sed -i '1i#!/usr/bin/env node' dist/index.js
chmod +x dist/cmd/issue.js
