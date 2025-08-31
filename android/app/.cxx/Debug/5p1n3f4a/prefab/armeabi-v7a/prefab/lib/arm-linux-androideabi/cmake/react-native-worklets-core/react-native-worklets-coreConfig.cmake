if(NOT TARGET react-native-worklets-core::rnworklets)
add_library(react-native-worklets-core::rnworklets SHARED IMPORTED)
set_target_properties(react-native-worklets-core::rnworklets PROPERTIES
    IMPORTED_LOCATION "/Users/seanswork/graphitti-mobile/GraphittiMobile/node_modules/react-native-worklets-core/android/build/intermediates/cxx/Debug/1v4u6te1/obj/armeabi-v7a/librnworklets.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/seanswork/graphitti-mobile/GraphittiMobile/node_modules/react-native-worklets-core/android/build/headers/rnworklets"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

