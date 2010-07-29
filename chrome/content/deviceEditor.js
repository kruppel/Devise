/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 :miv */
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

/**
 * \file  deviceEditor.js
 * \brief Javascript source for the device editor widget.
 */

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
//
// Device caps editor widget.
//
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
//
// Device caps editor imported services.
//
//------------------------------------------------------------------------------

// Component manager defs.
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var Cu = Components.utils;

// Songbird imports.
Cu.import("resource://app/jsmodules/DOMUtils.jsm");
Cu.import("resource://app/jsmodules/StringUtils.jsm");


//------------------------------------------------------------------------------
//
// Device volume menuitems services.
//
//------------------------------------------------------------------------------

var deviceEditorMenuItemsSvc = {
  //
  // Device volume menuitems object fields.
  //
  //   _widget                  Device volume menuitems widget.
  //   _device                  Widget device.
  //   _addedElementList        List of UI elements added by this widget.
  //   _addedElementListenerSet Set of listeners added to UI elements.
  //

  _widget: null,
  _device: null,
  _addedElementList: null,
  _addedElementListenerSet: null,


  /**
   * Initialize the device volume menuitems services for the device volume
   * menuitems widget specified by aWidget.
   *
   * \param aWidget             Device volume menuitems widget.
   */

  initialize: function deviceEditorMenuItemsSvc_initialize(aWidget) {
    // Do nothing if widget is not yet bound to a device.
    if (!aWidget.device)
      return;

    // Get the device volume menuitems widget and widget device.
    this._widget = aWidget;
    this._device = this._widget.device;

    // Listen to device events.
    var deviceEventTarget =
          this._device.QueryInterface(Ci.sbIDeviceEventTarget);
    deviceEventTarget.addEventListener(this);

    // Update UI.
    //this._update();
  },


  /**
   * Finalize the device volume menuitems services.
   */

  finalize: function deviceEditorMenuItemsSvc_finalize() {
    // Stop listening to device events.
    if (this._device) {
      var deviceEventTarget =
            this._device.QueryInterface(Ci.sbIDeviceEventTarget);
      deviceEventTarget.removeEventListener(this);
    }

    // Remove all added elements.
    this._removeAddedElements();

    // Clear object fields.
    this._widget = null;
    this._device = null;
  },


  //----------------------------------------------------------------------------
  //
  // Device editor menuitems sbIDeviceEventListener services.
  //
  //----------------------------------------------------------------------------

  /**
   * Handle the device event specified by aEvent.
   *
   * \param aEvent              Device event.
   */

  onDeviceEvent: function deviceEditorMenuItemsSvc_onDeviceEvent(aEvent) {

  },


};
