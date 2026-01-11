---
title: "Downloading iCloud Photo Library to your Synology for Backup"
description: "Thanks to Tom Insam for the inspiration What are we attempting? This takes all the photos out of your iCloud Photo Library and syncs them to your Synology. You end up with exactly the same photos on your synology volume…"
pubDate: "2022-06-22T02:41:11Z"
urlId: "2022/6/downloading-icloud-photo-library-to-your-synology-for-backup"
updatedDate: 2023-08-12
likeCount: 13
commentCount: 0
guid: "510ddd65e4b0837c157bd8f3:52603584e4b0c954af997030:62b2794afad9897d20203c09"
rssTitle: "Downloading iCloud Photo Library to your Synology for Backup"
rssDescription: "<p class=\"\">Thanks to <a href=\"https://movieos.org\"><span>Tom Insam</span></a> for the inspiration</p><h1>What are we attempting?</h1><p class=\"\">This takes all the photos out of your iCloud Photo Library and syncs them to your Synology. You end up with exactly the same photos on your synology volume as you do in iCloud. It’s important to note that this is a <em>sync</em> — if you delete a photo from iCloud, it’ll also delete from your Synology. This is done by watching the ‘deleted’ folder in iCloud, so if a photo goes missing <em>without</em> appearing in your deleted folder it will remain.</p> <p class=\"\"><em>Updated August 11, 2023: I’ve modified this guide to use a virtual environment instead of installing as root. It should run much more reliably and be less likely to break with DSM updates now. You also no longer need sudo.</em></p> <p class=\"\"><br><br></p><h1>Why would I do this?</h1><p class=\"\">Having your entire photo library in iCloud is a mild risk. It means your photos aren’t stored in a recognizable, hierarchical folder format and your access to the library depends on Apple continuing to offer a reliable service. Any cloud storage that syncs comes with a risk that all your photos could disappear suddenly — this prevents that from happening. If you’re a digital pack rat with every photo you’ve ever taken, this is for you.</p><p class=\"\"><br><br></p><h1>Other notes from me:</h1><ul data-rte-list=\"default\"><li><p class=\"\">For even more absurd redundancy, you can use Synology’s Glacier backup to copy your entire photo library up to <a href=\"https://aws.amazon.com/s3/storage-classes/glacier/\"><span>AWS Glacier</span></a> for cheap, offsite replication.</p></li><li><p class=\"\">These instructions assume you’re using a Mac, but Windows users should be able to accomplish this with WSL (Windows Systems for Linux) terminal commands.</p></li><li><p class=\"\">You probably shouldn’t empty the deleted photos folder more frequently than you run this script or it will leave photos on your Synology that you’ve removed from iCloud</p></li></ul><p class=\"\"><br><br></p><h1>Ingredients</h1><ol data-rte-list=\"default\"><li><p class=\"\">iCloud Photo Library</p></li><li><p class=\"\">Synology with plenty of extra storage space</p><ol data-rte-list=\"default\"><li><p class=\"\">Recommended: Not a slow CPU</p></li><li><p class=\"\">DSM 7.0 or later</p></li><li><p class=\"\">Your Synology’s local IP or domain (something like <code>&lt;synologyname&gt;.local</code>)</p></li><li><p class=\"\">Your Synology username and password</p></li></ol></li><li><p class=\"\">Familiarity with <code>ssh</code>, the terminal in general, and other computer inner workings</p></li></ol><p class=\"\"><br><br></p><h1>Instructions</h1><h2>0) Before you Begin</h2><ol data-rte-list=\"default\"><li><p class=\"\">Allow SSH through your Synology firewall (only if your firewall is on)</p><ol data-rte-list=\"default\"><li><p class=\"\">Open the Control Panel</p></li><li><p class=\"\">Go to Security &gt; Firewall &gt; Edit Rules</p></li><li><p class=\"\">Make sure ‘Encrypted Terminal Service’ appears on one of the entries with an action of ‘allow’</p></li></ol></li><li><p class=\"\">Turn on SSH</p><ol data-rte-list=\"default\"><li><p class=\"\">Open the Control Panel</p></li><li><p class=\"\">Go to Terminal &amp; SNMP</p></li><li><p class=\"\">Check ‘Enable SSH Service’</p></li><li><p class=\"\">Click ‘Apply’</p></li></ol></li><li><p class=\"\">SSH to Synology from your local machine</p><ol data-rte-list=\"default\"><li><p class=\"\">Open Terminal on your computer</p></li><li><p class=\"\">Enter the command `ssh &lt;synologyusername&gt;@&lt;synology domain or IP&gt;’ as in ‘ssh <a href=\"mailto:sam@harddrive.local\"><span>sam@harddrive.local</span></a>'</p></li><li><p class=\"\">Enter your synology password when prompted</p></li><li><p class=\"\">You’ll see a slightly different command prompt</p></li></ol></li></ol><h2>1) Install and set up Python</h2><ol data-rte-list=\"default\"><li><p class=\"\">It’s probably already done for you!</p><ol data-rte-list=\"default\"><li><p class=\"\">Check that it is by typing <code>python -V</code> into your terminal and pressing enter</p></li><li><p class=\"\">The result needs to be at least 3.6 (Mine was 3.8.8 which I believe is included with DSM 7.1)</p></li></ol></li><li><p class=\"\">Create a virtual environment in which to do all of the further work. This effectively sections off the python configuration being used for this project from anything else on your Synology, making sure different work you (or DSM) does won’t impact the iCloud Photos work. It’s recommended</p><ol data-rte-list=\"default\"><li><p class=\"\">Change to your user’s home directory by running <code>cd ~</code></p><ol data-rte-list=\"default\"><li><p class=\"\">Create a temp directory for use later by running <code>mkdir $HOME/tmp</code></p></li></ol></li><li><p class=\"\">Create the virtual environment using <code>python3 -m venv icloudpd</code></p></li><li><p class=\"\">Navigate into that folder with <code>cd icloudpd</code></p></li><li><p class=\"\">Activate the virtual environment by <code>source bin/activate</code></p><ol data-rte-list=\"default\"><li><p class=\"\"><em>Note: If you experience any disconnections after this point, re-activate your virtual environment using </em><code><em>cd ~/icloudpd;source bin/activate</em></code></p></li></ol></li></ol></li><li><p class=\"\">In order to install more Python packages, we need to install an up-to-date version of <code>pip</code>, the Python package manager</p><ol data-rte-list=\"default\"><li><p class=\"\">I followed <a href=\"https://techjogging.com/installing-and-using-pip-on-synology-dsm.html\">this great guide</a> to enable pip</p></li><li><p class=\"\">Run the following commands in your terminal</p><ol data-rte-list=\"default\"><li><p class=\"\"><code>python -m ensurepip</code></p></li><li><p class=\"\"><code>python3 -m pip install --upgrade pip</code></p></li></ol></li></ol></li><li><p class=\"\">The order of this step is very important — we need to install WHEEL first</p><ol data-rte-list=\"default\"><li><p class=\"\">Run the following commands in your terminal</p><ol data-rte-list=\"default\"><li><p class=\"\"><code>pip install wheel</code></p></li><li><p class=\"\"><code>pip install --upgrade wheel</code></p></li></ol></li></ol></li></ol><h2>2) Install the iCloud Photo Downloader</h2><ol data-rte-list=\"default\"><li><p class=\"\"><code>icloudpd</code> is available on <a href=\"https://github.com/icloud-photos-downloader/icloud_photos_downloader\">GitHub</a></p></li><li><p class=\"\">Run <code>pip install icloudpd</code></p></li></ol><h2>3) Set up iCloud authentication</h2><ol data-rte-list=\"default\"><li><p class=\"\">Run <code>icloud —username &lt;youremailaddress&gt;</code></p></li><li><p class=\"\">Enter your <em>real</em> iCloud password when prompted — app-specific passwords do NOT work because it is the API</p></li><li><p class=\"\">Two factor users will get prompted for your code. For some reason this defaults to the SMS fallback (if you’re still not using MFA on iCloud, you really should be)</p></li></ol><h2>4) Get your Synology ready</h2><ol data-rte-list=\"default\"><li><p class=\"\">Return to the DSM web user interface but <strong>do not</strong> disconnect your terminal yet</p></li><li><p class=\"\">Create a dedicated folder for your photos</p><ol data-rte-list=\"default\"><li><p class=\"\">Copy the path to your folder out to a note somewhere and save it for the next step</p></li><li><p class=\"\">Remember that you need to add <code>/volume1</code> (or a different number if you have more than one volume) to the beginning of your path</p></li></ol></li></ol><h2>5) Run some tests</h2><ol data-rte-list=\"default\"><li><p class=\"\">Return to your terminal. If your computer went to sleep at any point, you may have to <code>ssh</code> to your Synology again. Remember to reactivate your virtualenv</p></li><li><p class=\"\">Tell your subsequent work to use that temp directory we created earlier. If you don’t do this, everything will break. <code>export TMPDIR=$HOME/tmp</code></p></li><li><p class=\"\">Run <code>icloudpd -d &lt;path_to_your_folder&gt; -u &lt;iCloud_username&gt; --recent 10 --only-print-filenames --threads-num 2</code></p><p class=\"\"> If it fails — if you have spaces in your path, you’ll need to enclose in single quotes</p></li><li><p class=\"\">See if it succeeds (it should print 10 filenames)</p></li><li><p class=\"\">Try downloading a few dozen photos</p><ol data-rte-list=\"default\"><li><p class=\"\">Run <code>icloudpd -d &lt;path_to_your_folder&gt; -u &lt;iCloud_username&gt; --recent 50 --set-exif-datetime --auto-delete --threads-num 2</code></p></li></ol></li><li><p class=\"\">Check your folder using the Synology file browser to see if the photos are there and whether they open correctly</p></li></ol><h2>6) Set up scheduling</h2><ol data-rte-list=\"default\"><li><p class=\"\">In the Synology web UI, open Synology &gt; Control Panel &gt; Task Scheduler</p></li><li><p class=\"\">Create an upgrade script to keep the iCloud Photos Downloader up to date</p><ol data-rte-list=\"default\"><li><p class=\"\">Click Create &gt; Scheduled Task &gt; User-defined Script</p></li><li><p class=\"\">Fill out each tab as follows:</p><ol data-rte-list=\"default\"><li><p class=\"\">General: Give it a name, run as your user</p></li><li><p class=\"\">Schedule: your preference, I chose once a month</p></li><li><p class=\"\">Task Settings</p><ol data-rte-list=\"default\"><li><p class=\"\">Notification: Your email here, only if abnormal termination (if you want)</p></li><li><p class=\"\">Command: <code>cd icloudpd; source bin/activate; python -m pip install --upgrade icloudpd</code></p><p class=\"\"><em>Note: This is actually three commands in one — it changes to the icloudpd folder that we installed the python package in, activates the virtual environment, then does the upgrade</em></p></li></ol></li></ol></li><li><p class=\"\">Highlight the resulting entry and click ‘run’</p></li><li><p class=\"\">Click ‘Action’ &gt; ‘View Result’ and ensure that the Current Status is <code>Normal (0) or Requirement already satisfied…</code></p></li></ol></li><li><p class=\"\">Set up the script itself</p><ol data-rte-list=\"default\"><li><p class=\"\">Click Create &gt; Scheduled Task &gt; User-defined script again</p></li><li><p class=\"\">Fill out each tab as follows:</p><ol data-rte-list=\"default\"><li><p class=\"\">General: Give it a name, run as your user</p></li><li><p class=\"\">Schedule: Your preference, I chose daily at 4am</p><ol data-rte-list=\"default\"><li><p class=\"\">Note that this may occasionally take a long time to run, frequencies &lt;1 day aren’t recommended</p></li><li><p class=\"\">Because of the way this script tracks (and removes) deleted photos, it must be run at a frequency less than 30 days — deleted photos are pruned from iCloud after 30 days.</p></li></ol></li><li><p class=\"\">Task Settings</p><ol data-rte-list=\"default\"><li><p class=\"\">Notification: Same as above</p></li><li><p class=\"\">Command: <code>export TMPDIR=$HOME/tmp; cd icloudpd; source bin/activate; icloudpd -d /volume1/'Media Storage'/Pictures/'iCloud Photo Library' -u samgross144@gmail.com --set-exif-datetime --no-progress-bar --auto-delete --threads-num 2 --log-level error --recent 10 --only-print-filenames --dry-run</code></p></li></ol></li></ol></li></ol></li></ol><h2>7) (Optional) Save logs which is helpful</h2><ol data-rte-list=\"default\"><li><p class=\"\">Open Synology &gt; Control Panel &gt; Task Scheduler &gt; Settings</p><ol data-rte-list=\"default\"><li><p class=\"\">Check ‘save output results’ and give it a folder that you are ok with filling up</p></li><li><p class=\"\">Click ok</p></li></ol></li></ol><h2>8) Final Test</h2><ol data-rte-list=\"default\"><li><p class=\"\">Highlight the upgrade task by clicking on it and then click Run</p><ol data-rte-list=\"default\"><li><p class=\"\">Select Action &gt; View Result to see terminal output</p></li><li><p class=\"\">Make sure that the current status says ‘Normal (0)’</p></li></ol></li><li><p class=\"\">Highlight the download task and then click Run</p><ol data-rte-list=\"default\"><li><p class=\"\">This <strong>will download your entire iCloud Photo Library</strong> don’t do this when you need your bandwidth. My Synology maxed out at about 10Mbps download, a fraction of my available speed</p></li><li><p class=\"\">Select Action &gt; View Result to see terminal output</p><ol data-rte-list=\"default\"><li><p class=\"\">You should see ‘current status: running’ with <code>no data</code> as the output</p></li></ol></li></ol></li></ol><h2>9) Clean Up</h2><ol data-rte-list=\"default\"><li><p class=\"\">Quit your terminal app</p></li><li><p class=\"\">Turn off SSH on the Synology (remember to hit ‘apply’)</p></li><li><p class=\"\">Change log level if desired in the task settings by editing your scheduled task and replacing the last word (<code>info</code>) with <code>error</code></p></li><li><p class=\"\">Limit the comparisons to recent photos only if you’d like by adding <code>—-recent 1000 </code>to the end of your configuration (you can change the number if desired)</p></li></ol>"
---

Thanks to [Tom Insam](https://movieos.org) for the inspiration

# What are we attempting?

This takes all the photos out of your iCloud Photo Library and syncs them to your Synology. You end up with exactly the same photos on your synology volume as you do in iCloud. It’s important to note that this is a *sync* — if you delete a photo from iCloud, it’ll also delete from your Synology. This is done by watching the ‘deleted’ folder in iCloud, so if a photo goes missing *without* appearing in your deleted folder it will remain.

*Updated August 11, 2023: I’ve modified this guide to use a virtual environment instead of installing as root. It should run much more reliably and be less likely to break with DSM updates now. You also no longer need sudo.*

# Why would I do this?

Having your entire photo library in iCloud is a mild risk. It means your photos aren’t stored in a recognizable, hierarchical folder format and your access to the library depends on Apple continuing to offer a reliable service. Any cloud storage that syncs comes with a risk that all your photos could disappear suddenly — this prevents that from happening. If you’re a digital pack rat with every photo you’ve ever taken, this is for you.

# Other notes from me:

* For even more absurd redundancy, you can use Synology’s Glacier backup to copy your entire photo library up to [AWS Glacier](https://aws.amazon.com/s3/storage-classes/glacier/) for cheap, offsite replication.
* These instructions assume you’re using a Mac, but Windows users should be able to accomplish this with WSL (Windows Systems for Linux) terminal commands.
* You probably shouldn’t empty the deleted photos folder more frequently than you run this script or it will leave photos on your Synology that you’ve removed from iCloud

# Ingredients

1. iCloud Photo Library
2. Synology with plenty of extra storage space

   1. Recommended: Not a slow CPU
   2. DSM 7.0 or later
   3. Your Synology’s local IP or domain (something like `.local`)
   4. Your Synology username and password
3. Familiarity with `ssh`, the terminal in general, and other computer inner workings

# Instructions

## 0) Before you Begin

1. Allow SSH through your Synology firewall (only if your firewall is on)

   1. Open the Control Panel
   2. Go to Security > Firewall > Edit Rules
   3. Make sure ‘Encrypted Terminal Service’ appears on one of the entries with an action of ‘allow’
2. Turn on SSH

   1. Open the Control Panel
   2. Go to Terminal & SNMP
   3. Check ‘Enable SSH Service’
   4. Click ‘Apply’
3. SSH to Synology from your local machine

   1. Open Terminal on your computer
   2. Enter the command `ssh @’ as in ‘ssh [sam@harddrive.local](mailto:sam@harddrive.local)'
   3. Enter your synology password when prompted
   4. You’ll see a slightly different command prompt

## 1) Install and set up Python

1. It’s probably already done for you!

   1. Check that it is by typing `python -V` into your terminal and pressing enter
   2. The result needs to be at least 3.6 (Mine was 3.8.8 which I believe is included with DSM 7.1)
2. Create a virtual environment in which to do all of the further work. This effectively sections off the python configuration being used for this project from anything else on your Synology, making sure different work you (or DSM) does won’t impact the iCloud Photos work. It’s recommended

   1. Change to your user’s home directory by running `cd ~`

      1. Create a temp directory for use later by running `mkdir $HOME/tmp`
   2. Create the virtual environment using `python3 -m venv icloudpd`
   3. Navigate into that folder with `cd icloudpd`
   4. Activate the virtual environment by `source bin/activate`

      1. *Note: If you experience any disconnections after this point, re-activate your virtual environment using* `cd ~/icloudpd;source bin/activate`
3. In order to install more Python packages, we need to install an up-to-date version of `pip`, the Python package manager

   1. I followed [this great guide](https://techjogging.com/installing-and-using-pip-on-synology-dsm.html) to enable pip
   2. Run the following commands in your terminal

      1. `python -m ensurepip`
      2. `python3 -m pip install --upgrade pip`
4. The order of this step is very important — we need to install WHEEL first

   1. Run the following commands in your terminal

      1. `pip install wheel`
      2. `pip install --upgrade wheel`

## 2) Install the iCloud Photo Downloader

1. `icloudpd` is available on [GitHub](https://github.com/icloud-photos-downloader/icloud_photos_downloader)
2. Run `pip install icloudpd`

## 3) Set up iCloud authentication

1. Run `icloud —username`
2. Enter your *real* iCloud password when prompted — app-specific passwords do NOT work because it is the API
3. Two factor users will get prompted for your code. For some reason this defaults to the SMS fallback (if you’re still not using MFA on iCloud, you really should be)

## 4) Get your Synology ready

1. Return to the DSM web user interface but **do not** disconnect your terminal yet
2. Create a dedicated folder for your photos

   1. Copy the path to your folder out to a note somewhere and save it for the next step
   2. Remember that you need to add `/volume1` (or a different number if you have more than one volume) to the beginning of your path

## 5) Run some tests

1. Return to your terminal. If your computer went to sleep at any point, you may have to `ssh` to your Synology again. Remember to reactivate your virtualenv
2. Tell your subsequent work to use that temp directory we created earlier. If you don’t do this, everything will break. `export TMPDIR=$HOME/tmp`
3. Run `icloudpd -d  -u  --recent 10 --only-print-filenames --threads-num 2`

   If it fails — if you have spaces in your path, you’ll need to enclose in single quotes
4. See if it succeeds (it should print 10 filenames)
5. Try downloading a few dozen photos

   1. Run `icloudpd -d  -u  --recent 50 --set-exif-datetime --auto-delete --threads-num 2`
6. Check your folder using the Synology file browser to see if the photos are there and whether they open correctly

## 6) Set up scheduling

1. In the Synology web UI, open Synology > Control Panel > Task Scheduler
2. Create an upgrade script to keep the iCloud Photos Downloader up to date

   1. Click Create > Scheduled Task > User-defined Script
   2. Fill out each tab as follows:

      1. General: Give it a name, run as your user
      2. Schedule: your preference, I chose once a month
      3. Task Settings

         1. Notification: Your email here, only if abnormal termination (if you want)
         2. Command: `cd icloudpd; source bin/activate; python -m pip install --upgrade icloudpd`

            *Note: This is actually three commands in one — it changes to the icloudpd folder that we installed the python package in, activates the virtual environment, then does the upgrade*
   3. Highlight the resulting entry and click ‘run’
   4. Click ‘Action’ > ‘View Result’ and ensure that the Current Status is `Normal (0) or Requirement already satisfied…`
3. Set up the script itself

   1. Click Create > Scheduled Task > User-defined script again
   2. Fill out each tab as follows:

      1. General: Give it a name, run as your user
      2. Schedule: Your preference, I chose daily at 4am

         1. Note that this may occasionally take a long time to run, frequencies <1 day aren’t recommended
         2. Because of the way this script tracks (and removes) deleted photos, it must be run at a frequency less than 30 days — deleted photos are pruned from iCloud after 30 days.
      3. Task Settings

         1. Notification: Same as above
         2. Command: `export TMPDIR=$HOME/tmp; cd icloudpd; source bin/activate; icloudpd -d /volume1/'Media Storage'/Pictures/'iCloud Photo Library' -u samgross144@gmail.com --set-exif-datetime --no-progress-bar --auto-delete --threads-num 2 --log-level error --recent 10 --only-print-filenames --dry-run`

## 7) (Optional) Save logs which is helpful

1. Open Synology > Control Panel > Task Scheduler > Settings

   1. Check ‘save output results’ and give it a folder that you are ok with filling up
   2. Click ok

## 8) Final Test

1. Highlight the upgrade task by clicking on it and then click Run

   1. Select Action > View Result to see terminal output
   2. Make sure that the current status says ‘Normal (0)’
2. Highlight the download task and then click Run

   1. This **will download your entire iCloud Photo Library** don’t do this when you need your bandwidth. My Synology maxed out at about 10Mbps download, a fraction of my available speed
   2. Select Action > View Result to see terminal output

      1. You should see ‘current status: running’ with `no data` as the output

## 9) Clean Up

1. Quit your terminal app
2. Turn off SSH on the Synology (remember to hit ‘apply’)
3. Change log level if desired in the task settings by editing your scheduled task and replacing the last word (`info`) with `error`
4. Limit the comparisons to recent photos only if you’d like by adding `—-recent 1000` to the end of your configuration (you can change the number if desired)
