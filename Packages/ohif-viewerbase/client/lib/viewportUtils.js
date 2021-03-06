import { Session } from 'meteor/session';
import { Random } from 'meteor/random';
import { $ } from 'meteor/jquery';
import { _ } from 'meteor/underscore';
// Local Modules
import { OHIF } from 'meteor/ohif:core';
import { updateOrientationMarkers } from './updateOrientationMarkers';
import { getInstanceClassDefaultViewport } from './instanceClassSpecificViewport';

const getActiveViewportElement = () => {
    const viewportIndex = Session.get('activeViewport') || 0;
    return $('.imageViewerViewport').get(viewportIndex);
};

const zoomIn = () => {
    const element = getActiveViewportElement();
    if (!element) {
        return;
    }

    const viewport = cornerstone.getViewport(element);
    const scaleIncrement = 0.15;
    const maximumScale = 10;
    viewport.scale = Math.min(viewport.scale + scaleIncrement, maximumScale);
    cornerstone.setViewport(element, viewport);
};

const zoomOut = () => {
    const element = getActiveViewportElement();
    if (!element) {
        return;
    }

    const viewport = cornerstone.getViewport(element);
    const scaleIncrement = 0.15;
    const minimumScale = 0.05;
    viewport.scale = Math.max(viewport.scale - scaleIncrement, minimumScale);
    cornerstone.setViewport(element, viewport);
};

const zoomToFit = () => {
    const element = getActiveViewportElement();
    if (!element) {
        return;
    }

    cornerstone.fitToWindow(element);
};

const rotateL = () => {
    const element = getActiveViewportElement();
    if (!element) {
        return;
    }

    const viewport = cornerstone.getViewport(element);
    viewport.rotation -= 90;
    cornerstone.setViewport(element, viewport);
    updateOrientationMarkers(element, viewport);
};

const rotateR = () => {
    const element = getActiveViewportElement();
    if (!element) {
        return;
    }

    const viewport = cornerstone.getViewport(element);
    viewport.rotation += 90;
    cornerstone.setViewport(element, viewport);
    updateOrientationMarkers(element, viewport);
};

const invert = () => {
    const element = getActiveViewportElement();
    if (!element) {
        return;
    }

    const viewport = cornerstone.getViewport(element);
    viewport.invert = (viewport.invert === false);
    cornerstone.setViewport(element, viewport);
};

const flipV = () => {
    const element = getActiveViewportElement();
    const viewport = cornerstone.getViewport(element);
    viewport.vflip = (viewport.vflip === false);
    cornerstone.setViewport(element, viewport);
    updateOrientationMarkers(element, viewport);
};

const flipH = () => {
    const element = getActiveViewportElement();
    const viewport = cornerstone.getViewport(element);
    viewport.hflip = (viewport.hflip === false);
    cornerstone.setViewport(element, viewport);
    updateOrientationMarkers(element, viewport);
};

const resetViewport = () => {
    const element = getActiveViewportElement();
    const enabledElement = cornerstone.getEnabledElement(element);
    if (enabledElement.fitToWindow === false) {
        const imageId = enabledElement.image.imageId;
        const instance = cornerstoneTools.metaData.get('instance', imageId);

        enabledElement.viewport = cornerstone.getDefaultViewport(enabledElement.canvas, enabledElement.image);

        const instanceClassDefaultViewport = getInstanceClassDefaultViewport(instance, enabledElement, imageId);
        cornerstone.setViewport(element, instanceClassDefaultViewport);
    } else {
        cornerstone.reset(element);
    }
};

const clearTools = () => {
    const element = getActiveViewportElement();
    const toolStateManager = cornerstoneTools.globalImageIdSpecificToolStateManager;
    toolStateManager.clear(element);
    cornerstone.updateImage(element);
};

const linkStackScroll = () => {
    const synchronizer = OHIF.viewer.stackImagePositionOffsetSynchronizer;

    if(!synchronizer) {
        return;
    }

    if(synchronizer.isActive()) {
        synchronizer.deactivate();
    } else {
        synchronizer.activate();
    }
};

// This function was originally defined alone inside client/lib/toggleDialog.js
// and has been moved here to avoid circular dependency issues.
const toggleDialog = element => {
    const $element = $(element);
    if($element.is('dialog')) {
        if (element.hasAttribute('open')) {
            stopAllClips();
            element.close();
        } else {
            element.show();
        }
    }
    else {
        const isClosed = $element.hasClass('dialog-open');
        $element.toggleClass('dialog-closed', isClosed);
        $element.toggleClass('dialog-open', !isClosed);
    }

    Session.set('UpdateCINE', Random.id());
};

// Toggle the play/stop state for the cornerstone clip tool
const toggleCinePlay = () => {
    // Get the active viewport element
    const element = getActiveViewportElement();

    // Check if it's playing the clip to toggle it
    if (isPlaying()) {
        cornerstoneTools.stopClip(element);
    } else {
        cornerstoneTools.playClip(element);
    }

    // Update the UpdateCINE session property
    Session.set('UpdateCINE', Random.id());
};

// Show/hide the CINE dialog
const toggleCineDialog = () => {
    const dialog = document.getElementById('cineDialog');
    toggleDialog(dialog);
};

// Check if the clip is playing on the active viewport
const isPlaying = () => {
    // Create a dependency on LayoutManagerUpdated and UpdateCINE session
    Session.get('UpdateCINE');
    Session.get('LayoutManagerUpdated');

    // Get the viewport element and its current playClip tool state
    const element = getActiveViewportElement();
    // Empty Elements throws cornerstore exception
    if (!element || !$(element).find('canvas').length) {
        return;
    }

    const toolState = cornerstoneTools.getToolState(element, 'playClip');

    // Stop here if the tool state is not defined yet
    if (!toolState) {
        return false;
    }

    // Get the clip state
    const clipState = toolState.data[0];
    
    if(clipState) {
        // Return true if the clip is playing
        return !_.isUndefined(clipState.intervalId);
    }

    return false;
};

// Check if a study has multiple frames
const hasMultipleFrames = () => {
    // Its called everytime active viewport and/or layout change
    Session.get('activeViewport');
    Session.get('LayoutManagerUpdated');

    const activeViewport = getActiveViewportElement();

    // No active viewport yet: disable button
    if(!activeViewport || !$(activeViewport).find('canvas').length) {
      return true;
    }

    // Get images in the stack
    const stackToolData = cornerstoneTools.getToolState(activeViewport, 'stack');

    // No images in the stack, so disable button
    if (!stackToolData || !stackToolData.data || !stackToolData.data.length) {
        return true;
    }

    // Get number of images in the stack
    const stackData = stackToolData.data[0];
    const nImages = stackData.imageIds && stackData.imageIds.length ? stackData.imageIds.length : 1;

    // Stack has just one image, so disable button
    if(nImages === 1) {
      return true;
    }

    return false;
};

// Stop clips on all non-empty elements
const stopAllClips = () => {
    const elements = $('.imageViewerViewport').not('.empty');
    elements.each( (index, element) => {
        if ($(element).find('canvas').length) {
            cornerstoneTools.stopClip(element);
        }
    });
};


const isStackScrollLinkingDisabled = () => {
    // Its called everytime active viewport and/or layout change
    Session.get('viewportActivated');
    Session.get('LayoutManagerUpdated');

    const synchronizer = OHIF.viewer.stackImagePositionOffsetSynchronizer;
    const linkableViewports = synchronizer.getLinkableViewports();

    return linkableViewports.length <= 1;
};

// Create an event listener to update playing state when a clip stops playing
$(window).on('CornerstoneToolsClipStopped', () => Session.set('UpdateCINE', Random.id()));

/**
 * Export functions inside viewportUtils namespace.
 */

const viewportUtils = {
    getActiveViewportElement,
    zoomIn,
    zoomOut,
    zoomToFit,
    rotateL,
    rotateR,
    invert,
    flipV,
    flipH,
    resetViewport,
    clearTools,
    linkStackScroll,
    toggleDialog,
    toggleCinePlay,
    toggleCineDialog,
    isPlaying,
    hasMultipleFrames,
    stopAllClips,
    isStackScrollLinkingDisabled
};

export { viewportUtils };
