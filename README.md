# Photobooth Server

Takes a picture with a canon camera using GPhoto2. 

Has API endpoints to upload an image to Google Photos.

Best used with the [Photobooth react front-end](https://github.com/KdG-Photobooth/Photobooth).

## Prerequisites
This needs to run on a Linux machine, like a raspberry pi with raspbian installed.  
Your machine needs [gphoto2](https://github.com/lwille/node-gphoto2) installed, as explained in the [Node Gphoto2 repository](https://github.com/lwille/node-gphoto2)

## Installation

git clone https://github.com/KdG-Photobooth/Server.git  
cd Server  
npm install


### Disable mouse / screen sleep on Pi
sudo nano /etc/lightdm/lightdm.conf
xserver-command=X -s 0 dpms -nocursor