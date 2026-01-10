---
title: "Downloading iCloud Photo Library to your Synology for Backup"
description: "Thanks to Tom Insam for the inspiration What are we attempting? This takes all the photos out of your iCloud Photo Library and syncs them to your Synology. You end up with exactly the same photos on your synology volume…"
pubDate: 2022-06-22
urlId: "2022/6/downloading-icloud-photo-library-to-your-synology-for-backup"
updatedDate: 2023-08-12
likeCount: 13
commentCount: 0
---

<div class="sqs-layout sqs-grid-12 columns-12" data-layout-label="Post Body" data-type="item" data-updated-on="1655864965231" id="item-62b2794afad9897d20203c09"><div class="row sqs-row"><div class="col sqs-col-12 span-12"><div class="sqs-block html-block sqs-block-html" data-block-type="2" data-border-radii="&#123;&quot;topLeft&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;topRight&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;bottomLeft&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;bottomRight&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;&#125;" data-sqsp-block="text" id="block-9cdac56de63e8d68d3bb"><div class="sqs-block-content">

<div class="sqs-html-content" data-sqsp-text-block-content>
  <p class="" style="white-space:pre-wrap;">Thanks to <a href="https://movieos.org"><span style="text-decoration:underline">Tom Insam</span></a> for the inspiration</p><h1 style="white-space:pre-wrap;">What are we attempting?</h1><p class="" style="white-space:pre-wrap;">This takes all the photos out of your iCloud Photo Library and syncs them to your Synology. You end up with exactly the same photos on your synology volume as you do in iCloud. It’s important to note that this is a <em>sync</em> — if you delete a photo from iCloud, it’ll also delete from your Synology. This is done by watching the ‘deleted’ folder in iCloud, so if a photo goes missing <em>without</em> appearing in your deleted folder it will remain.</p>
</div>




















  
  



</div></div><div class="sqs-block html-block sqs-block-html" data-block-type="2" data-border-radii="&#123;&quot;topLeft&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;topRight&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;bottomLeft&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;bottomRight&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;&#125;" data-sqsp-block="text" id="block-yui_3_17_2_1_1691804542012_14960"><div class="sqs-block-content">

<div class="sqs-html-content" data-sqsp-text-block-content>
  <p class="" style="white-space:pre-wrap;"><em>Updated August 11, 2023: I’ve modified this guide to use a virtual environment instead of installing as root. It should run much more reliably and be less likely to break with DSM updates now. You also no longer need sudo.</em></p>
</div>




















  
  



</div></div><div class="sqs-block html-block sqs-block-html" data-block-type="2" data-border-radii="&#123;&quot;topLeft&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;topRight&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;bottomLeft&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;,&quot;bottomRight&quot;:&#123;&quot;unit&quot;:&quot;px&quot;,&quot;value&quot;:0.0&#125;&#125;" data-sqsp-block="text" id="block-yui_3_17_2_1_1691804542012_15140"><div class="sqs-block-content">

<div class="sqs-html-content" data-sqsp-text-block-content>
  <p class="" style="white-space:pre-wrap;"><br><br></p><h1 style="white-space:pre-wrap;">Why would I do this?</h1><p class="" style="white-space:pre-wrap;">Having your entire photo library in iCloud is a mild risk. It means your photos aren’t stored in a recognizable, hierarchical folder format and your access to the library depends on Apple continuing to offer a reliable service. Any cloud storage that syncs comes with a risk that all your photos could disappear suddenly — this prevents that from happening. If you’re a digital pack rat with every photo you’ve ever taken, this is for you.</p><p class="" style="white-space:pre-wrap;"><br><br></p><h1 style="white-space:pre-wrap;">Other notes from me:</h1><ul data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">For even more absurd redundancy, you can use Synology’s Glacier backup to copy your entire photo library up to <a href="https://aws.amazon.com/s3/storage-classes/glacier/"><span style="text-decoration:underline">AWS Glacier</span></a> for cheap, offsite replication.</p></li><li><p class="" style="white-space:pre-wrap;">These instructions assume you’re using a Mac, but Windows users should be able to accomplish this with WSL (Windows Systems for Linux) terminal commands.</p></li><li><p class="" style="white-space:pre-wrap;">You probably shouldn’t empty the deleted photos folder more frequently than you run this script or it will leave photos on your Synology that you’ve removed from iCloud</p></li></ul><p class="" style="white-space:pre-wrap;"><br><br></p><h1 style="white-space:pre-wrap;">Ingredients</h1><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">iCloud Photo Library</p></li><li><p class="" style="white-space:pre-wrap;">Synology with plenty of extra storage space</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Recommended: Not a slow CPU</p></li><li><p class="" style="white-space:pre-wrap;">DSM 7.0 or later</p></li><li><p class="" style="white-space:pre-wrap;">Your Synology’s local IP or domain (something like <code>&lt;synologyname&gt;.local</code>)</p></li><li><p class="" style="white-space:pre-wrap;">Your Synology username and password</p></li></ol></li><li><p class="" style="white-space:pre-wrap;">Familiarity with <code>ssh</code>, the terminal in general, and other computer inner workings</p></li></ol><p class="" style="white-space:pre-wrap;"><br><br></p><h1 style="white-space:pre-wrap;">Instructions</h1><h2 style="white-space:pre-wrap;">0) Before you Begin</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Allow SSH through your Synology firewall (only if your firewall is on)</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Open the Control Panel</p></li><li><p class="" style="white-space:pre-wrap;">Go to Security &gt; Firewall &gt; Edit Rules</p></li><li><p class="" style="white-space:pre-wrap;">Make sure ‘Encrypted Terminal Service’ appears on one of the entries with an action of ‘allow’</p></li></ol></li><li><p class="" style="white-space:pre-wrap;">Turn on SSH</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Open the Control Panel</p></li><li><p class="" style="white-space:pre-wrap;">Go to Terminal &amp; SNMP</p></li><li><p class="" style="white-space:pre-wrap;">Check ‘Enable SSH Service’</p></li><li><p class="" style="white-space:pre-wrap;">Click ‘Apply’</p></li></ol></li><li><p class="" style="white-space:pre-wrap;">SSH to Synology from your local machine</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Open Terminal on your computer</p></li><li><p class="" style="white-space:pre-wrap;">Enter the command `ssh &lt;synologyusername&gt;@&lt;synology domain or IP&gt;’ as in ‘ssh <a href="mailto:sam@harddrive.local"><span style="text-decoration:underline">sam@harddrive.local</span></a>'</p></li><li><p class="" style="white-space:pre-wrap;">Enter your synology password when prompted</p></li><li><p class="" style="white-space:pre-wrap;">You’ll see a slightly different command prompt</p></li></ol></li></ol><h2 style="white-space:pre-wrap;">1) Install and set up Python</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">It’s probably already done for you!</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Check that it is by typing <code>python -V</code> into your terminal and pressing enter</p></li><li><p class="" style="white-space:pre-wrap;">The result needs to be at least 3.6 (Mine was 3.8.8 which I believe is included with DSM 7.1)</p></li></ol></li><li><p class="" style="white-space:pre-wrap;">Create a virtual environment in which to do all of the further work. This effectively sections off the python configuration being used for this project from anything else on your Synology, making sure different work you (or DSM) does won’t impact the iCloud Photos work. It’s recommended</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Change to your user’s home directory by running <code>cd ~</code></p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Create a temp directory for use later by running <code>mkdir $HOME/tmp</code></p></li></ol></li><li><p class="" style="white-space:pre-wrap;">Create the virtual environment using <code>python3 -m venv icloudpd</code></p></li><li><p class="" style="white-space:pre-wrap;">Navigate into that folder with <code>cd icloudpd</code></p></li><li><p class="" style="white-space:pre-wrap;">Activate the virtual environment by <code>source bin/activate</code></p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;"><em>Note: If you experience any disconnections after this point, re-activate your virtual environment using </em><code><em>cd ~/icloudpd;source bin/activate</em></code></p></li></ol></li></ol></li><li><p class="" style="white-space:pre-wrap;">In order to install more Python packages, we need to install an up-to-date version of <code>pip</code>, the Python package manager</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">I followed <a href="https://techjogging.com/installing-and-using-pip-on-synology-dsm.html">this great guide</a> to enable pip</p></li><li><p class="" style="white-space:pre-wrap;">Run the following commands in your terminal</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;"><code>python -m ensurepip</code></p></li><li><p class="" style="white-space:pre-wrap;"><code>python3 -m pip install --upgrade pip</code></p></li></ol></li></ol></li><li><p class="" style="white-space:pre-wrap;">The order of this step is very important — we need to install WHEEL first</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Run the following commands in your terminal</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;"><code>pip install wheel</code></p></li><li><p class="" style="white-space:pre-wrap;"><code>pip install --upgrade wheel</code></p></li></ol></li></ol></li></ol><h2 style="white-space:pre-wrap;">2) Install the iCloud Photo Downloader</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;"><code>icloudpd</code> is available on <a href="https://github.com/icloud-photos-downloader/icloud_photos_downloader">GitHub</a></p></li><li><p class="" style="white-space:pre-wrap;">Run <code>pip install icloudpd</code></p></li></ol><h2 style="white-space:pre-wrap;">3) Set up iCloud authentication</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Run <code>icloud —username &lt;youremailaddress&gt;</code></p></li><li><p class="" style="white-space:pre-wrap;">Enter your <em>real</em> iCloud password when prompted — app-specific passwords do NOT work because it is the API</p></li><li><p class="" style="white-space:pre-wrap;">Two factor users will get prompted for your code. For some reason this defaults to the SMS fallback (if you’re still not using MFA on iCloud, you really should be)</p></li></ol><h2 style="white-space:pre-wrap;">4) Get your Synology ready</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Return to the DSM web user interface but <strong>do not</strong> disconnect your terminal yet</p></li><li><p class="" style="white-space:pre-wrap;">Create a dedicated folder for your photos</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Copy the path to your folder out to a note somewhere and save it for the next step</p></li><li><p class="" style="white-space:pre-wrap;">Remember that you need to add <code>/volume1</code> (or a different number if you have more than one volume) to the beginning of your path</p></li></ol></li></ol><h2 style="white-space:pre-wrap;">5) Run some tests</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Return to your terminal. If your computer went to sleep at any point, you may have to <code>ssh</code> to your Synology again. Remember to reactivate your virtualenv</p></li><li><p class="" style="white-space:pre-wrap;">Tell your subsequent work to use that temp directory we created earlier. If you don’t do this, everything will break. <code>export TMPDIR=$HOME/tmp</code></p></li><li><p class="" style="white-space:pre-wrap;">Run <code>icloudpd -d &lt;path_to_your_folder&gt; -u &lt;iCloud_username&gt; --recent 10 --only-print-filenames --threads-num 2</code></p><p class="" style="white-space:pre-wrap;">             If it fails — if you have spaces in your path, you’ll need to enclose in single quotes</p></li><li><p class="" style="white-space:pre-wrap;">See if it succeeds (it should print 10 filenames)</p></li><li><p class="" style="white-space:pre-wrap;">Try downloading a few dozen photos</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Run <code>icloudpd -d &lt;path_to_your_folder&gt; -u &lt;iCloud_username&gt; --recent 50 --set-exif-datetime --auto-delete --threads-num 2</code></p></li></ol></li><li><p class="" style="white-space:pre-wrap;">Check your folder using the Synology file browser to see if the photos are there and whether they open correctly</p></li></ol><h2 style="white-space:pre-wrap;">6) Set up scheduling</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">In the Synology web UI, open Synology &gt; Control Panel &gt; Task Scheduler</p></li><li><p class="" style="white-space:pre-wrap;">Create an upgrade script to keep the iCloud Photos Downloader up to date</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Click Create &gt; Scheduled Task &gt; User-defined Script</p></li><li><p class="" style="white-space:pre-wrap;">Fill out each tab as follows:</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">General: Give it a name, run as your user</p></li><li><p class="" style="white-space:pre-wrap;">Schedule: your preference, I chose once a month</p></li><li><p class="" style="white-space:pre-wrap;">Task Settings</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Notification: Your email here, only if abnormal termination (if you want)</p></li><li><p class="" style="white-space:pre-wrap;">Command: <code>cd icloudpd; source bin/activate; python -m pip install --upgrade icloudpd</code></p><p class="" style="white-space:pre-wrap;"><em>Note: This is actually three commands in one — it changes to the icloudpd folder that we installed the python package in, activates the virtual environment, then does the upgrade</em></p></li></ol></li></ol></li><li><p class="" style="white-space:pre-wrap;">Highlight the resulting entry and click ‘run’</p></li><li><p class="" style="white-space:pre-wrap;">Click ‘Action’ &gt; ‘View Result’ and ensure that the Current Status is <code>Normal (0) or Requirement already satisfied…</code></p></li></ol></li><li><p class="" style="white-space:pre-wrap;">Set up the script itself</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Click Create &gt; Scheduled Task &gt; User-defined script again</p></li><li><p class="" style="white-space:pre-wrap;">Fill out each tab as follows:</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">General: Give it a name, run as your user</p></li><li><p class="" style="white-space:pre-wrap;">Schedule: Your preference, I chose daily at 4am</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Note that this may occasionally take a long time to run, frequencies &lt;1 day aren’t recommended</p></li><li><p class="" style="white-space:pre-wrap;">Because of the way this script tracks (and removes) deleted photos, it must be run at a frequency less than 30 days — deleted photos are pruned from iCloud after 30 days.</p></li></ol></li><li><p class="" style="white-space:pre-wrap;">Task Settings</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Notification: Same as above</p></li><li><p class="" style="white-space:pre-wrap;">Command: <code>export TMPDIR=$HOME/tmp; cd icloudpd; source bin/activate; icloudpd -d /volume1/'Media Storage'/Pictures/'iCloud Photo Library' -u samgross144@gmail.com --set-exif-datetime --no-progress-bar --auto-delete --threads-num 2 --log-level error --recent 10 --only-print-filenames --dry-run</code></p></li></ol></li></ol></li></ol></li></ol><h2 style="white-space:pre-wrap;">7) (Optional) Save logs which is helpful</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Open Synology &gt; Control Panel &gt; Task Scheduler &gt; Settings</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Check ‘save output results’ and give it a folder that you are ok with filling up</p></li><li><p class="" style="white-space:pre-wrap;">Click ok</p></li></ol></li></ol><h2 style="white-space:pre-wrap;">8) Final Test</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Highlight the upgrade task by clicking on it and then click Run</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Select Action &gt; View Result to see terminal output</p></li><li><p class="" style="white-space:pre-wrap;">Make sure that the current status says ‘Normal (0)’</p></li></ol></li><li><p class="" style="white-space:pre-wrap;">Highlight the download task and then click Run</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">This <strong>will download your entire iCloud Photo Library</strong> don’t do this when you need your bandwidth. My Synology maxed out at about 10Mbps download, a fraction of my available speed</p></li><li><p class="" style="white-space:pre-wrap;">Select Action &gt; View Result to see terminal output</p><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">You should see ‘current status: running’ with <code>no data</code> as the output</p></li></ol></li></ol></li></ol><h2 style="white-space:pre-wrap;">9) Clean Up</h2><ol data-rte-list="default"><li><p class="" style="white-space:pre-wrap;">Quit your terminal app</p></li><li><p class="" style="white-space:pre-wrap;">Turn off SSH on the Synology (remember to hit ‘apply’)</p></li><li><p class="" style="white-space:pre-wrap;">Change log level if desired in the task settings by editing your scheduled task and replacing the last word (<code>info</code>) with <code>error</code></p></li><li><p class="" style="white-space:pre-wrap;">Limit the comparisons to recent photos only if you’d like by adding <code>—-recent 1000 </code>to the end of your configuration (you can change the number if desired)</p></li></ol>
</div>




















  
  



</div></div></div></div></div>
