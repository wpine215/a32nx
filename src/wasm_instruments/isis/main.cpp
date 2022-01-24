#include <MSFS\MSFS.h>
#include "MSFS\MSFS_Render.h"
#include "MSFS\Render\nanovg.h"
#include <MSFS\Legacy\gauges.h>

#include <stdio.h>
#include <string.h>
#include <math.h>
#include <map>

#ifdef _MSC_VER
#define snprintf _snprintf_s
#elif !defined(__MINGW32__)
#include <iconv.h>
#endif

std::map <FsContext, NVGcontext*> IsisNVGContext;

extern "C" {
    MSFS_CALLBACK bool ISIS_gauge_callback(FsContext ctx, int service_id, void* pData) {
        switch(service_id) {
            case PANEL_SERVICE_PRE_INSTALL:
            {
                return true;
            }
            break;
            case PANEL_SERVICE_POST_INSTALL:
            {
                return true;
            }
            break;
            case PANEL_SERVICE_PRE_DRAW:
            {
                return true;
            }
            break;
            case PANEL_SERVICE_PRE_KILL:
            {
                return true;
            }
            break;
        }
        return false;
    }
}
