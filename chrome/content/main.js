/*
 *=BEGIN SONGBIRD GPL
 *
 * This file is part of the Songbird web player.
 *
 * Copyright(c) 2005-2010 POTI, Inc.
 * http://www.songbirdnest.com
 *
 * This file may be licensed under the terms of of the
 * GNU General Public License Version 2 (the ``GPL'').
 *
 * Software distributed under the License is distributed
 * on an ``AS IS'' basis, WITHOUT WARRANTY OF ANY KIND, either
 * express or implied. See the GPL for the specific language
 * governing rights and limitations.
 *
 * You should have received a copy of the GPL along with this
 * program. If not, go to http://www.gnu.org/licenses/gpl.html
 * or write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 *
 *=END SONGBIRD GPL
 */

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

if (typeof(gBrowser) == 'undefined')
  var gBrowser = Cc["@mozilla.org/appshell/window-mediator;1"]
                 .getService(Ci.nsIWindowMediator)
                 .getMostRecentWindow("Songbird:Main").window.gBrowser;

if (typeof(deviceRegistrar) == 'undefined')
  var deviceRegistrar = Cc["@songbirdnest.com/Songbird/DeviceManager;2"]
                        .getService(Ci.sbIDeviceRegistrar);

if (typeof(deviceInfoRegistrar) == 'undefined')
  var deviceInfoRegistrar = Cc["@songbirdnest.com/Songbird/sbDefaultMSCInfoRegistrar;1"]
                            .getService(Ci.sbIDeviceInfoRegistrar);

if (typeof(deviceManager) == 'undefined')
  var deviceManager = Cc["@songbirdnest.com/Songbird/DeviceManager;2"]
                      .getService(Ci.sbIDeviceManager2);

if (typeof(gMetrics) == 'undefined')
  var gMetrics = Cc["@songbirdnest.com/Songbird/Metrics;1"]
                 .createInstance(Ci.sbIMetrics);

Cu.import("resource://app/jsmodules/PlatformUtils.jsm");
Cu.import("resource://app/jsmodules/WindowUtils.jsm");

const NS = "http://songbirdnest.com/device/1.0#";
const VENDOR_ID = NS + "usbVendorId";
const PRODUCT_ID = NS + "usbProductId";

const CONTENT_AUDIO = 3;
const CONTENT_IMAGE = 4;
const CONTENT_VIDEO = 5;
const CONTENT_PLAYLIST = 6;

if (typeof Devise == 'undefined') {
  var Devise = {};
}

Devise = {
  //
  // Devise configuration.
  //
  //  _windowObjectReference  Window reference.
  //  _platformSeparator      Platform specific path separator.
  //  _page2WindowHeight      Page 2 height.
  //  _page3WindowHeight      Page 3 height.
  //  _nboxInterval           Notification box listener interval.
  //

  _windowObjectReference: null,
  _platformSeparator: "/",
  _page2WindowHeight: null,
  _page3WindowHeight: 425,
  _nboxInterval: null,

  //
  // Devise object fields.
  //
  //  _device                Bound device.
  // 

  _device: null,

  //
  // Devise UI elements.
  //
  //  _deviceTree            Device tree menu.
  //  _editButton            Edit button on page 1.
  //  _headerName            Header name
  //

  /**
   * \brief Runs on Songbird startup.
   *
   * \param
   */
  onLoad: function Devise__onLoad() {
    // initialization code
    this._initialized = true;
    this._strings = document.getElementById("devise-strings");
    
    // Perform extra actions the first time the extension is run
    if (Application.prefs.get("extensions.devise.firstrun").value) {
      Application.prefs.setValue("extensions.devise.firstrun", false);
      this._firstRunSetup();
    }

    // Set file delimiter to back slash for Windows
    if (PlatformUtils.platformString == "Windows_NT") {
      this._platformSeparator = "\\";
    }
  },

  /**
   * \brief Initializes Devise tool. 
   *
   * \param
   */
  init: function Devise__init() {
    var self = this;
    deviceManager.QueryInterface(Ci.sbIDeviceEventTarget).addEventListener(this._onMgrEvent);

    this._deck = document.getElementById("dce-deck");
    this._deviceTree = document.getElementById("dce-devices-tree");
    this._editButton = document.getElementById("dce-edit-button");
    this._resetButton = document.getElementById("dce-reset-button");
    this._headerName = document.getElementById("dce-header-name");

    // Wire up UI events for Summary buttons
    this._editButton.addEventListener('command',
      function(event) { self._onEditClick(event); }, false);

    this._resetButton.addEventListener('command',
      function(event) { self._onResetClick(event); }, false);

    // Wire up device treeitem selection
    this._deviceTree.addEventListener('select', 
      function() { self._onDeviceSelected(); }, false);

    var devicesArray = deviceRegistrar.devices;
    this._deviceChildren = document.getElementById("dce-devices");

    for (var i = 0; i < devicesArray.length; i++) {
      var curDevice = devicesArray.queryElementAt(i, Ci.sbIDevice);
      this._createDevice(curDevice);
    }
  },

  /**
   * \brief Listens for Device Manager events.
   *
   * \param aEvent  The device event. 
   */
  _onMgrEvent: function Devise__onMgrEvent(aEvent) {
    var self = this;

    switch (aEvent.type) {
      case Ci.sbIDeviceEvent.EVENT_DEVICE_REMOVED:
        var device = aEvent.data.QueryInterface(Ci.sbIDevice);
        Devise._removeDevice(device);
        break;
      case Ci.sbIDeviceEvent.EVENT_DEVICE_LIBRARY_REMOVED:
        Devise._updateDevices();
        break;
      case Ci.sbIDeviceEvent.EVENT_DEVICE_READY:
        var device = aEvent.data.QueryInterface(Ci.sbIDevice);
        Devise._createDevice(device);
        break;
    }
  },

  /**
   * \brief Creates a device treeitem for mounted MSC devices.
   *
   * \param aDevice          The device item to add to the tree.
   */
  _createDevice: function Devise__createDevice(aDevice) {
    if (aDevice.content.libraries.length > 0 &&
        aDevice.parameters.getProperty("DeviceType") == "MSCUSB") {
      var item = document.createElement("treeitem")
      var row = document.createElement("treerow");
      var name = document.createElement("treecell");
      var id = document.createElement("treecell");

      name.setAttribute("label", aDevice.name);
      id.setAttribute("value", aDevice.id);
      row.appendChild(name);
      row.appendChild(id);
      item.appendChild(row);

      if (item) {
        var devItems = document.getElementsByAttribute("value", aDevice.id);

        if (devItems.length < 1)
          this._deviceChildren.appendChild(item);
      }
    }
  },

  /**
   * \brief Iterates through devices to check if any should be removed.
   *
   * \param
   */
  _updateDevices: function Devise__updateDevices() {
    var el = this._deviceChildren.firstChild;
    var count = 0;

    while (el) {
      id = this._deviceTree.view.getCellValue(count, this._deviceTree.columns[1]);
      var device = deviceRegistrar.getDevice(Components.ID(id));

      if (device.content.libraries.length < 1) {
        this._deviceChildren.removeChild(el);
        this._checkForceClose(device.id);
      } else {
        count++;
      }

      el = el.nextSibling;
    }
  },

  /**
   * \brief Removes a device from the tree.
   *
   * \param aDevice          The device item to remove from the tree.
   */
  _removeDevice: function Devise__removeDevice(aDevice) {
    var self = this;
    var id = aDevice.id;
    try {
      var el = document.getElementsByAttribute("value", aDevice.id)[0];

      if (el != null) { 
        self._deviceChildren.removeChild(el.parentNode.parentNode);
        self._checkForceClose(aDevice.id);
      }
    } catch (e) {
      Cu.reportError("Error occurred when trying to remove device from tree: " + e);
    }
  },

  /**
   * \brief Force closes the editor if the selected device is ejected mid-edit.
   *
   * \param aId              The device id prompting a check for a force close.
   */
  _checkForceClose: function Devise__checkForceClose(aId) {
    if (this._deviceID == aId && this._deck.selectedIndex > 0) {
      // XXX - Should write a dialog to notify user why window is closing
      // Either that or reset to page 1
      alert(this._friendlyName + " has been ejected.");
      window.close();
    }
  },

  /**
   * \brief Updates summary info when device is selected in tree.
   *
   * \param
   */
  _onDeviceSelected: function Devise__onDeviceSelected() {
    var self = this;

    if (this._editButton.disabled)
      this._editButton.disabled = false;

    if (this._resetButton.disabled)
      this._resetButton.disabled = false;

    var row = this._deviceTree.currentIndex;
    this._deviceID = this._deviceTree
                         .view.getCellValue(row, this._deviceTree.columns[1]);

    this._device = deviceRegistrar.getDevice(Components.ID(this._deviceID));
    var deviceProperties = this._device.properties;

    // Mount path of primary volume
    this._primaryVolume = this._device.content.libraries
                                              .queryElementAt(0, Ci.sbIDeviceLibrary).guid;
    this._volumePref = ".library." + this._primaryVolume + ".last_mount_path";
    this._folderPath = this._device.getPreference(this._volumePref);

    this._manufacturer = deviceProperties.vendorName;
    this._model = deviceProperties.modelNumber;

    if (deviceProperties.friendlyName != null) {
      this._friendlyName = deviceProperties.friendlyName;
    } else {
      this._friendlyName = this._manufacturer + " " + this._model;
    }

    this._serialNo = deviceProperties.serialNumber;

    this._vendorId = this._formatUsbId(deviceProperties.properties.get(VENDOR_ID)
                                                       .toString(16));
    this._productId = this._formatUsbId(deviceProperties.properties.get(PRODUCT_ID)
                                                        .toString(16));

    var devIcon = document.getElementById("dce-device-icon");
    var devIconURL = this._getDeviceIcon(this._device);

    /*
    var consoleService = Cc["@mozilla.org/consoleservice;1"]
                         .getService(Ci.nsIConsoleService);
    consoleService.logStringMessage("Changing model from " + this._device.properties.modelNumber);
    this._device.properties.modelNumber = "Hero";
    consoleService.logStringMessage("Model changed to " + this._device.properties.modelNumber);
    */

    if (devIcon.src != devIconURL) 
      devIcon.src = devIconURL;

    var devName = document.getElementById("dce-device-name1");
    var devMfr = document.getElementById("dce-device-mfr");
    var devModel = document.getElementById("dce-device-model");
    var devSerialNo = document.getElementById("dce-serial-no");
    var devDescIds = document.getElementById("dce-descriptor");

    if (devName.childNodes[0] || devMfr.childNodes[0] || devModel.childNodes[0] || devSerialNo[0]) { 
      devName.removeChild(devName.firstChild);
      devMfr.removeChild(devMfr.firstChild);
      devModel.removeChild(devModel.firstChild);
      devSerialNo.removeChild(devSerialNo.firstChild);
      devDescIds.removeChild(devDescIds.firstChild);
    }

    this._trimDesc(devName, this._friendlyName);
    this._trimDesc(devMfr, this._manufacturer);
    this._trimDesc(devModel, this._model);
    this._trimDesc(devSerialNo, this._serialNo);

    devDescIds.appendChild(document.createTextNode(this._vendorId + "/" + this._productId));

    // Supports reformat
    var supportsReformat = this._device.supportsReformat;

    var formatCBArray = document.getElementsByClassName("folder-checkbox");
    var capsCBArray = document.getElementsByClassName("caps-checkbox");
    var imgCBArray = document.getElementsByClassName("img-caps-checkbox");

    // XXX - Garbage... need to refactor
    for (var i = 0; i < formatCBArray.length; i++) {
      formatCBArray[i].addEventListener('click',
        function(event) {
          if (event.target.checked) {
            event.target.nextSibling.disabled = false;
            event.target.nextSibling.nextSibling.disabled = false;
            event.target.nextSibling.nextSibling.nextSibling.disabled = false;
          } else {
            event.target.nextSibling.disabled = true;
            event.target.nextSibling.nextSibling.disabled = true;
            event.target.nextSibling.nextSibling.nextSibling.disabled = true;
          }
        }, false);
    }

    for (var i = 0; i < capsCBArray.length; i++) {
      capsCBArray[i].addEventListener('click',
        function(event) {
          let drawer = event.target.nextSibling;

          let oldHeight = window.getComputedStyle(drawer, null).getPropertyValue("height");

          if (event.target.checked) {
            self._expandDrawer(drawer);
          } else {
            self._closeDrawer(drawer);
          }

          let h = window.outerHeight + 
                  Devise._calcDrawerHeight(oldHeight, drawer);
          window.resizeTo(window.outerWidth, h);
          rEnabler(event.target.nextSibling, event.target.checked);

        }, false);

      rEnabler(capsCBArray[i].nextSibling, false);
    }

    for (var i = 0; i < imgCBArray.length; i++) {
      imgCBArray[i].addEventListener('click',
        function(event) {
          rEnabler(event.target.nextSibling, event.target.checked);
        }, false);

      rEnabler(imgCBArray[i].nextSibling, false);
    }
    // XXX

  },

  /**
   * \brief Opens a file picker to select a device folder location.
   *
   * \param aEvent  The event that triggers the file picker listener.
   */
  _findFolder: function Devise__findFolder(aEvent) {
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

    var localDir = Cc["@mozilla.org/file/local;1"]
                   .createInstance(Ci.nsILocalFile);
 
    localDir.initWithPath(this._folderPath);

    fp.displayDirectory = localDir;

    fp.init(window, "Select a folder on " + this._device.name, nsIFilePicker.modeGetFolder);
    fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);

    var rv = fp.show();
    if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
      var file = fp.file;
      var path = fp.file.path;
      aEvent.target.previousSibling.value = path;
    }
  },

  /**
   * \brief Formats usb id to be more uniform.
   *
   * \param aUsbId  The usb descriptor id (e.g. productId, vendorId).
   */
  _formatUsbId: function Devise__formatUsbId(aUsbId) {
    var formatted = "0x";    

    if (aUsbId.length < 4) {
      formatted += "0" + aUsbId;
    } else {
      formatted += aUsbId;
    }

    return formatted;
  },

  /**
   * \brief Gets the device summary icon.
   *
   * \param  The device to check, defaults to generic icon if no icon uri is available.
   */
  _getDeviceIcon: function Devise__getDeviceIcon(aDevice) {
    var spec = "chrome://songbird/skin/device/icon-generic-device.png";

    try {
      var uri = aDevice.properties.iconUri;
      spec = uri.spec;
      if (uri.schemeIs("file") && /\.ico$/(spec)) {
        spec = "moz-icon://" + spec + "?size=64";
      }
      return spec;
    } catch (err) {
      return spec;
    }
  },

  /**
   * \brief Listens to edit button events, setting up page 2 for the editor.
   *
   * \param aEvent  The event that triggers the loading of page 2. 
   */
  _onEditClick: function Devise__onEditClick(aEvent) {
    if (this._deviceID) {
      window.resizeTo(475,305);
      this._deck.selectedIndex = 1;
      this._headerName.value = this._friendlyName;
      document.getElementById("dce-header").hidden = false;
    } else {
      return;
    }

    // Metrics
    gMetrics.metricsInc( "dceditor", this._friendlyName, this._serialNo);
    gMetrics.metricsInc( "dceditor", this._manufacturer + "." + this._model, this._serialNo);
    gMetrics.metricsInc( "dceditor", this._vendorId + "." + this._productId, this._serialNo);

    // Change header icon
    var devIconSmall = document.getElementById("dce-devicon-small");

    try {
      var devIconUri = this._device.properties.getProperty("spDeviceIcon")
                                              .QueryInterface(Ci.nsIURI);
      devIconSmall.src = devIconUri.spec;
    } catch (e) {
      devIconSmall.src = "chrome://songbird/skin/service-pane/icon-device.png";
    }  
 
    this._mountMediaOnly = deviceInfoRegistrar.getOnlyMountMediaFolders(this._device); 

    if (this._mountMediaOnly) {
      var mountCB = document.getElementById("mount-only-checkbox");
      mountCB.checked = true;
    }

    this._musicFolder = deviceInfoRegistrar.getDeviceFolder(this._device, CONTENT_AUDIO);
    this._imageFolder = deviceInfoRegistrar.getDeviceFolder(this._device, CONTENT_IMAGE);
    this._playlistFolder = deviceInfoRegistrar.getDeviceFolder(this._device, CONTENT_PLAYLIST);

    var musicFolderBox = document.getElementById("music-folder");
    var imageFolderBox = document.getElementById("image-folder");
    var playlistFolderBox = document.getElementById("playlist-folder");

    this._loadFolder(musicFolderBox, this._musicFolder);
    this._loadFolder(imageFolderBox, this._imageFolder);
    this._loadFolder(playlistFolderBox, this._playlistFolder);

    var excludeArray = deviceInfoRegistrar.getExcludedFolders(this._device).split(",");

    var excludeDrawer = document.getElementById("exclude-drawer-multi");
    excludeDrawer.addItem(true, null, null);

    for (var i = 0; i < excludeArray.length; i++) {
      var path = excludeArray[i];
      var fp = {};

      if (path) {
        if (PlatformUtils.platformString == "Windows_NT") {
          var re = /\//g;
          fp = this._folderPath + path.replace(re, "\\");
        } else {
          fp = this._folderPath + this._platformSeparator + path;
        }

        excludeDrawer.parent
                     .getElementsByClassName("exclude-textbox")[i]
                     .value = fp;
      }

      if (excludeArray[i+1] != null)
        excludeDrawer.addItem(true, null, null);
    }
  },

  /**
   * \brief Listens to reset button events.
   *
   * \param aEvent           The event that triggers the reset.
   */
  _onResetClick: function Devise__onResetClick(aEvent) {
    if (!this._device || !this._device.id)
      return Cu.reportError("No device to act on.");

    var dirs = Cc["@songbirdnest.com/moz/xpcom/threadsafe-array;1"]
                 .createInstance(Ci.nsIMutableArray);

    var profd = Cc["@mozilla.org/file/directory_service;1"]
                  .getService(Ci.nsIProperties)
                  .get("ProfD", Ci.nsIFile);

    var paths = ["db", "devices"]
    for each (path in paths) {
      let dir = profd.clone();
      dir.append(path);
      dirs.appendElement(dir, false);
    }

    var id = this._device.id.toString();
    id = id.replace(/[{}-]/g, "");

    var direnum = dirs.enumerate();
    while (direnum.hasMoreElements()) {
      let dir = direnum.getNext();
      let entries = dir.directoryEntries;
      if (!entries)
        continue;
      while (entries.hasMoreElements()) {
        let entry = entries.getNext();
        entry.QueryInterface(Ci.nsIFile);
        if (entry.path.indexOf(id) != -1)
          entry.remove(true);
      }
    }

    var hidden = false;
    var done = false;

    while (!done) {
      var sbs = Cc["@mozilla.org/file/local;1"]
                  .createInstance(Ci.nsILocalFile);
      var sbspath = this._folderPath + this._platformSeparator;

      if (hidden) {
        sbspath += ".";
        done = true;
      } else {
        hidden = true;
      }

      sbspath += "SBSettings.xml";

      sbs.initWithPath(sbspath);
      if (sbs.exists())
        sbs.remove(false);
    }
    
    this._showRestartNotification("Reset will take effect after a restart.", "PRIORITY_WARNING_HIGH");
  },

  /**
   * \brief Toggles the format box, opening/closing the "drawer".
   *
   * \param aEvent           The event that triggers the toggle. 
   */
  _toggleFormatBox: function Devise__toggleFormatBox(aEvent) {
    // XXX - Should change this to be static
    var drawer = aEvent.target.parentNode.parentNode;

    var oldHeight = window.getComputedStyle(drawer, null).getPropertyValue("height");

    if (drawer.childNodes[0].lastChild.label == "+") {
      this._expandDrawer(drawer);
    } else {
      this._closeDrawer(drawer);
    }

    var newHeight = window.outerHeight + this._calcDrawerHeight(oldHeight, drawer);
    window.resizeTo(window.outerWidth, newHeight);  
  },

  /**
   * \brief Expands the drawer box.
   *
   * \param aDrawer          The drawer to expand.
   */
  _expandDrawer: function Devise__expandDrawer(aDrawer) {
    var boxNodes = aDrawer.childNodes;

    boxNodes[0].lastChild.label = "-";

    for (var i = 1; i < boxNodes.length; i++) {
      boxNodes[i].hidden = false;
    }
  },

  /**
   * \brief Closes the drawer box.
   *
   * \param aDrawer          The drawer to close.
   */
  _closeDrawer: function Devise__closeDrawer(aDrawer) {
    var boxNodes = aDrawer.childNodes;

    boxNodes[0].lastChild.label = "+";

    for (var i = 1; i < boxNodes.length; i++) {
      boxNodes[i].hidden = true;
    }
  },

  /**
   * \brief Calculates drawer height.
   *
   * \param aHeight          The drawer's height before the change.
   * \param aDrawer          The drawer to take into calculation.
   */
  _calcDrawerHeight: function Devise__calcDrawerHeight(aHeight, aDrawer) {
    var re = /(\d+)px/;

    var curHeight = window.getComputedStyle(aDrawer, null).getPropertyValue("height");

    aHeight = aHeight.replace(re, "$1");
    curHeight = curHeight.replace(re, "$1");
    var diff = curHeight - aHeight;

    return diff;
  },

  /**
   * \brief Handles forward events for editor.
   *
   * \param aEvent           The event that triggers the forward action. 
   */
  _goFwd: function Devise__goFwd(aEvent) {
    var idx = this._deck.selectedIndex;

    switch(idx) {
      case "1":
        this._page2WindowHeight = window.outerHeight;

        window.resizeTo(475, this._page3WindowHeight);
        this._deck.selectedIndex = 2;

        var capsCheckboxArray = document.getElementsByClassName("caps-checkbox");

        // XXX - Need to write a function to do a complete reset of page
        for (var i = 0; i < capsCheckboxArray.length; i++) {
          var cb = capsCheckboxArray[i];
          var d = cb.nextSibling
          cb.checked = false;

          this._closeDrawer(d);
          rEnabler(d, false);

          var s = d.getElementsByClassName("sr-checkbox");
          for (var j = 0; j < s.length; j++) {
            s[j].checked = false;
          }
        }

        var caps = this._device.capabilities;
        var retFormats = caps.getSupportedFunctionTypes({});

        for (var rIdx in retFormats) {
          var contentArray = caps.getSupportedContentTypes(retFormats[rIdx], {});

          for (var cIdx=0; cIdx < contentArray.length; cIdx++) {
            var formatArray = caps.getSupportedMimeTypes(contentArray[cIdx], {});

            for (var fIdx=0; fIdx < formatArray.length; fIdx++) {

              var formats = caps.getFormatTypes(contentArray[cIdx],
                                                formatArray[fIdx],
                                                {});

              for each (format in formats) {
                if (format instanceof Ci.sbIAudioFormatType) {
                  format.QueryInterface(Ci.sbIAudioFormatType);

                  this._setAudioFormat(formatArray[fIdx], format);
                } else if (format instanceof Ci.sbIImageFormatType) {
                  format.QueryInterface(Ci.sbIImageFormatType);

                  var imgCB = document.getElementsByAttribute("mime", format.imageFormat)[0];
                  imgCB.checked = true;
                  rEnabler(imgCB.parentNode, true);
                }  else if (format instanceof Ci.sbIPlaylistFormatType) {
                  format.QueryInterface(Ci.sbIPlaylistFormatType);
              
                  document.getElementById("playlist-support").checked = true;
                }
              }
            }
          }
        }
        break;

      case "2":
        window.resizeTo(475,345);
        this._deck.selectedIndex = 3;
        break;

      default:
        break;
    }
  },

  /**
   * \brief Populates audio formats on page 3.
   *
   * \param aMime            The mime type to set.
   * \param aFormat          The format type to set.
   */
  _setAudioFormat: function Devise__setAudioFormat(aMime, aFormat) {
    var bitrates = aFormat.supportedBitrates;
    var samplerates = format.supportedSampleRates;
    var sr = {};
    var drawer = {};

    var capsCB = document.getElementsByAttribute("mime", aMime);
    var container = aFormat.containerFormat;

    // AAC handling
    if (capsCB.length > 1 && capsCB[0].getAttribute("container") != container) {
      capsCB[1].checked = true;
      drawer = capsCB[1].nextSibling;
    } else {
      capsCB[0].checked = true;
      drawer = capsCB[0].nextSibling;
    }

    // No bitrates for raw/uncompressed formats
    if (bitrates != null) {
      drawer.getElementsByClassName("min-br")[0].value = bitrates.min / 1000;
      drawer.getElementsByClassName("max-br")[0].value = bitrates.max / 1000;
    }

    rEnabler(drawer, true);

    this._setSampleRates(drawer.getElementsByClassName("sr-box")[0], samplerates);
  },

  /**
   * \brief Handles back events for the editor.
   *
   * \param aEvent           The event that triggers the backwards action.
   */
  _goBack: function Devise__goBack(aEvent) {
    var idx = this._deck.selectedIndex;
    switch(idx) {
      case "1":
        this._clearFolderPage();
        document.getElementById("dce-header").hidden = true;
        window.resizeTo(475,382);
        this._deck.selectedIndex = 0;
        break;

      case "2":
        window.resizeTo(475, this._page2WindowHeight);
        this._deck.selectedIndex = 1;
        break;

      case "3":
        this._removeRestartNotifications();

        var capsCheckboxArray = document.getElementsByClassName("caps-checkbox");

        for (var i = 0; i < capsCheckboxArray.length; i++) {
          var cb = capsCheckboxArray[i];
          var d = cb.nextSibling
          this._closeDrawer(d);
        }

        window.resizeTo(475, this._page3WindowHeight); 
        this._deck.selectedIndex = 2;

      default:
        break;
    }
  },

  /**
   * \brief Populates a folder into a textbox on page 2. Disables the folder row if
   *        there is no folder.
   *
   * \param aBox     The box targeted for population.
   * \param aFolder  The folder to populate in the textbox/row.
   */
  _loadFolder: function Devise__loadFolder(aBox, aFolder) {
    var elems = aBox.childNodes;

    if (aFolder != null) {
      elems[0].checked = true;
      elems[2].value = this._folderPath + this._platformSeparator + aFolder;
    } else {
      for (var i = 1; i <= 3; i++) {
        elems[i].disabled = true;
      }
    }
  },

  /**
   * \brief Resets page 2 by clearing folder rows, setting them to their default
   *        state, and removing the exclude rows.
   *
   * \param
   */
  _clearFolderPage: function Devise__clearFolderPage() {
    var fb = document.getElementsByClassName("folder-box");
    var exDrawer = document.getElementById("exclude-drawer-multi");

    for (var i = 0; i < fb.length; i++) {
      var fbChildren = fb[i].childNodes;
      fbChildren[2].value = "";
      fbChildren[0].checked = false;

      for (var j = 1; j <= 3; j++) {
        fbChildren[j].disabled = false;
      }
    }

    var drawers = exDrawer.parent.getElementsByAttribute("sbtype", "drawer-item");

    while(drawers[0]) {
      exDrawer.removeItem(true, drawers[0]);
    }
  },

  /**
   * \brief Populates page 3's sample rates for selected formats.
   *
   * \param aBox          The box for the device's supported format.
   * \param aSampleRates  The array of sample rates supported by the given 
   *                      format (designated by aBox).
   */
  _setSampleRates: function Devise__setSampleRates(aBox, aSampleRates) {
    for (var i = 0; i < aSampleRates.valueCount; i++) {
      var val = aSampleRates.GetValue(i);

      try {
        aBox.getElementsByAttribute("value", val)[0].checked = true;
      } catch(e) {
        Cu.reportError("Invalid sample rate used: " + val);
        Cu.reportError(e);
      }
    }
  },

  /**
   * \brief Writes the settings to an SBSettings.xml file, which is moved to
   *        .SBSettings.xml on restart.
   *
   * \param
   */
  _writeToFile: function Devise__writeToFile() {
    dump("Writing to SBSettings.xml file.\n");
    var serializer = new XMLSerializer();

    var file = Cc["@mozilla.org/file/local;1"]
               .createInstance(Ci.nsILocalFile)
    file.initWithPath(this._folderPath + this._platformSeparator + "SBSettings.xml");

    // file is nsIFile, data is a string
    var foStream = Cc["@mozilla.org/network/file-output-stream;1"]
                   .createInstance(Ci.nsIFileOutputStream);

    foStream.init(file, 0x04 | 0x08 | 0x20, 0666, 0);

    var converter = Cc["@mozilla.org/intl/converter-output-stream;1"]
                    .createInstance(Ci.nsIConverterOutputStream);
    converter.init(foStream, "UTF-8", 0, 0);

    var doc = document.implementation.createDocument("", "", null);

    var xsbsettings = doc.createElementNS("http://songbirdnest.com/devicesettings", "settings");

    var xname = doc.createElementNS("http://songbirdnest.com/device/1.0", "name");
    xname.setAttribute("value", this._friendlyName);

    var xdeviceinfo = doc.createElementNS("http://songbirdnest.com/deviceinfo/1.0", "deviceinfo");

    var folderBoxes = document.getElementsByClassName("folder-box");
    var excludeDrawer = document.getElementById("exclude-drawer-multi");
    var excludeBoxes = excludeDrawer.parent.getElementsByClassName("exclude-textbox");

    var xdevicecaps = doc.createElementNS("http://songbirdnest.com/devicecaps/1.0", "devicecaps");

    var xaudio = doc.createElement("audio");
    var ximage = doc.createElement("image");
    var xplaylist = doc.createElement("playlist");

    var aFormatBoxes = document.getElementsByClassName("caps-checkbox");
    var iFormatBoxes = document.getElementsByClassName("img-caps-checkbox");
    var pFormatBox = document.getElementById("playlist-support");

    for each (afbox in aFormatBoxes) {
      if (afbox.checked) {
        var mime = afbox.getAttribute("mime");
        var container = afbox.getAttribute("container");
        var codec = afbox.getAttribute("codec");

        var af = doc.createElement("format");
        af.setAttribute("mime", mime);
        af.setAttribute("container", container);
        af.setAttribute("codec", codec);

        if (mime != "audio/x-wav") {
          var afbr = doc.createElement("bitrates");
          var brange = doc.createElement("range");
          var min = afbox.parentNode.getElementsByClassName("min-br")[0].value * 1000; 
          var max = afbox.parentNode.getElementsByClassName("max-br")[0].value * 1000;

          brange.setAttribute("min", min);
          brange.setAttribute("max", max);
          brange.setAttribute("step", 1);

          afbr.appendChild(brange);
          af.appendChild(afbr);
        }
       
        var srboxes = afbox.parentNode.getElementsByClassName("sr-checkbox");
        var afsr = doc.createElement("samplerates");

        for (var i = 0; i < srboxes.length; i++) {
          if (srboxes[i].checked) {
            var val = doc.createElement("value");
            val.appendChild(doc.createTextNode(srboxes[i].label));
            afsr.appendChild(val);
          }
        }

        af.appendChild(afsr);

        var afch = doc.createElement("channels");
        var crange = doc.createElement("range");

        crange.setAttribute("min", 1);
        crange.setAttribute("max", 2);
        crange.setAttribute("step", 1);

        afch.appendChild(crange);
        af.appendChild(afch);

        xaudio.appendChild(af);
      }
    }

    for each (ifbox in iFormatBoxes) {
      if (ifbox.checked) {
        var mime = ifbox.getAttribute("mime");

        var imgf = doc.createElement("format");
        imgf.setAttribute("mime", mime);

        var exsizes = doc.createElement("explicit-sizes");

        var xsize = doc.createElement("size");
        var xwidths = doc.createElement("widths");
        var xheights = doc.createElement("heights");

        var wrange = doc.createElement("range");
        var hrange = doc.createElement("range");

        xsize.setAttribute("width", 200);
        xsize.setAttribute("height", 200);

        wrange.setAttribute("min", 16);
        wrange.setAttribute("max", 2048);
        wrange.setAttribute("step", 1);

        hrange.setAttribute("min", 16);
        hrange.setAttribute("max", 2048);
        hrange.setAttribute("step", 1);

        exsizes.appendChild(xsize);
        xwidths.appendChild(wrange);
        xheights.appendChild(hrange);

        imgf.appendChild(exsizes);
        imgf.appendChild(xwidths);
        imgf.appendChild(xheights);

        ximage.appendChild(imgf);
      }
    }

    if (aFormatBoxes.length > 0)
      xdevicecaps.appendChild(xaudio);

    if (iFormatBoxes.length > 0)
      xdevicecaps.appendChild(ximage);

    if (pFormatBox.checked) {
      var pf = doc.createElement("format");
      pf.setAttribute("mime", "audio/x-mpegurl");

      xplaylist.appendChild(pf);
      xdevicecaps.appendChild(xplaylist);
    }

    for (var i = 0; i < folderBoxes.length; i++) {
      var fc = folderBoxes[i].childNodes; 

      if (fc[0].checked && fc[1].value) {
        var type = fc[1].value.toLowerCase();
        var url = this._extractPath(fc[2].value);

        var xfolder = doc.createElement("folder");
        xfolder.setAttribute("type", type);
        xfolder.setAttribute("url", url);

        xdeviceinfo.appendChild(xfolder);
      }
    }

    for (var i = 0; i < excludeBoxes.length; i++) {
      if (excludeBoxes[i].value) {
        var url = this._extractPath(excludeBoxes[i].value);

        var xexclude = doc.createElement("excludefolder");
        xexclude.setAttribute("url", url);
        xdeviceinfo.appendChild(xexclude);
      }
    }

    if (document.getElementById("mount-only-checkbox").checked) {
      var xmountonly = doc.createElement("onlymountmediafolders");
      xmountonly.setAttribute("value", "true");
      xdeviceinfo.appendChild(xmountonly);
    }

    // By default, set reformat option to false
    var xsupportsreformat = doc.createElement("supportsreformat");
    xsupportsreformat.setAttribute("value", "false");
    xdeviceinfo.appendChild(xsupportsreformat);

    xdeviceinfo.appendChild(xdevicecaps);

    xsbsettings.appendChild(xname);
    xsbsettings.appendChild(xdeviceinfo);
    doc.appendChild(xsbsettings);

    var xmlString = XML(serializer.serializeToString(doc)).toXMLString();
    converter.writeString(xmlString);
    converter.close();
  },

  /**
   * \brief Trims a description element if too long, appending an ellipsis and 
   *        adding a tooltip.
   *
   * \param aDesc            The description element to check.
   * \param aText            The text to insert into the description. 
   */
  // XXX - Need to make this configurable, i.e. + aLength
  _trimDesc: function Devise__trimDesc(aDesc, aText) {
    if (aText.length < 25) {
      if (aText.length != 0 && aText != " ") {
        aDesc.appendChild(document.createTextNode(aText));
      } else {
        aDesc.appendChild(document.createTextNode("N/A"));
      }
    } else {
      aDesc.appendChild(document.createTextNode(aText.substr(0,24) + "..."));
      aDesc.setAttribute("tooltiptext", aText);
    }
  },

  /**
   * \brief Extracts the subpath from a full volume path.
   *
   * \param aURI             The full volume path to use for extraction.
   */
  _extractPath: function Devise__extractPath(aURI) {
    if (aURI.indexOf(this._folderPath) == 0) {
      if (PlatformUtils.platformString == "Windows_NT") {
        var re = /\\/g;
        var path = aURI.replace(re, "/");
        return path.substring(this._folderPath.length, path.length);
      } else {
        return aURI.substring(this._folderPath.length + 1, aURI.length);
      }
    }
  },

  /**
   * \brief Completes the editor flow, writing the SBSettings.xml and prompting
   *        for restart.
   *
   * \param
   */
  _completeEdit: function Devise__completeEdit() {
    this._writeToFile();
    this._showRestartNotification("These settings will take effect after a restart.", "PRIORITY_WARNING_HIGH");
  },

  /**
   * \brief Removes restart notification.
   *
   * \param
   */
  _removeRestartNotifications: function Devise__removeRestartNotifications() {
    var oldNotif;
    var nbox = document.getElementById("dce-restart");

    while ((oldNotif = nbox.getNotificationWithValue("dce_restart_notice"))) {
      nbox.removeNotification(oldNotif);
    }

    this._stopNotificationListener();
  },

  /**
   * \brief Shows the restart notification.
   *
   * \param
   */
  _showRestartNotification: function Devise__showRestartNotification(aMsg, aLevel) {
    var nbox = document.getElementById("dce-restart");
    this._removeRestartNotifications();
    var level = aLevel || "PRIORITY_CRITICAL_LOW";
    var btns = [{accessKey: "R",
                 callback: function() { WindowUtils.restartApp(); },
                 label: "Restart",
                 popup: null},
                {accessKey: "C",
                 callback: function() { window.close(); },
                 label: "Close",
                 popup: null}];

    nbox.appendNotification(aMsg,
                            "dce_restart_notice",
                            null,
                            nbox[level],
                            btns);

    this._startNotificationListener(nbox);

  },

  /**
   * \brief Initiates the notification listener.
   *
   * \param
   */
  _startNotificationListener: function Devise__startNotificationListener(aNbox) {
    var initialized = false;
    var oldHeight = 0;
    var origNboxHeight = 0;
    var func = function() { 
                 var re = /(\d+)px/;

                 var nboxh = window.getComputedStyle(aNbox, null).getPropertyValue("height");
                 nboxh = parseInt(nboxh.replace(re, "$1"));

                 var outerHeight = window.outerHeight;
                 if (!initialized) {
                   initialized = true;
                   oldHeight = outerHeight;
                   origNboxHeight = nboxh;
                   window.resizeTo(475, nboxh + outerHeight);
                 } else if (origNboxHeight > nboxh) {
                   window.resizeTo(475, oldHeight);
                 }
               };

    this._nboxInterval = window.setInterval(func, 200);
  },

  /**
   * \brief Clears the notification listener.
   *
   * \param
   */
  _stopNotificationListener: function Devise__stopNotificationListener() {
    if (this._nboxInterval)
      window.clearInterval(this._nboxInterval);

    this._nboxInterval = null;
  }, 
 
  /**
   * \brief Runs when the window is about to close.
   *
   * \param
   */
  onUnLoad: function() {
    deviceManager.QueryInterface(Ci.sbIDeviceEventTarget).removeEventListener(this._onMgrEvent);

    this._initialized = false;
  },
  
  /**
   * \brief Runs on the first run.
   *
   * \param
   */
  _firstRunSetup : function() {
  
  },

  /**
   * \brief Launches the Devise editor.
   *
   * \param
   */
  launchEditor : function() {
    if (this._windowObjectReference == null || this._windowObjectReference.closed) {    
      this._windowObjectReference = window.open("chrome://devise/content/dceditor.xul",
                                                "devise-window",
                                                "chrome,centerscreen,resizable");
    } else {
      this._windowObjectReference.focus();
    }
  },
  
};

/**
 * \brief Recursively steps through elements to enable/disable.
 *
 * \param aNode              The parent node from which to start the pass.
 * \param aState             The enable/disable state. 
 */
function rEnabler(aNode, aState) {
  try {
    if (aNode.hasChildNodes()) {
      aNode.disabled = !aState;

      for each (child in aNode.childNodes) {
        rEnabler(child, aState);
      }
    } else {
      aNode.disabled = !aState;
    }
  } catch (e) {
    aNode.disabled = !aState;
  }
}

window.addEventListener("load", function(e) { Devise.onLoad(e); }, false);
window.addEventListener("unload", function(e) { Devise.onUnLoad(e); }, false);
